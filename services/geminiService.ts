import { GoogleGenAI, Type } from "@google/genai";
import { LogRecord, RecordType, TemperatureRecord, MaintenanceRecord, Machine } from "../types";
import { getStoredApiKey } from "./storageService";

let aiClient: GoogleGenAI | null = null;

// OPTIONAL: If you want to hardcode the key for your build, paste it here.
const HARDCODED_API_KEY = ""; 

export const resetAiClient = () => {
  aiClient = null;
};

const getClient = () => {
  if (aiClient) return aiClient;
  
  // 1. Env Variable (Build time)
  let key = (typeof process !== 'undefined' && process.env && process.env.API_KEY) 
    ? process.env.API_KEY 
    : '';

  // 2. Hardcoded fallback (Developer override)
  if (!key) key = HARDCODED_API_KEY;

  // 3. Runtime Config (Admin Panel / Cloud Sync)
  if (!key) {
    key = getStoredApiKey();
  }
  
  if (!key) {
    return null;
  }
  
  aiClient = new GoogleGenAI({ apiKey: key });
  return aiClient;
};

export const checkAiStatus = async (): Promise<{ok: boolean, message: string}> => {
    const ai = getClient();
    if (!ai) return { ok: false, message: "API Key is missing. Configure in Admin Panel." };
    
    try {
        await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "Test connection."
        });
        return { ok: true, message: "AI Connection Optimal" };
    } catch (e: any) {
        return { ok: false, message: `Connection Failed: ${e.message || e}` };
    }
};

export const analyzeMaintenanceIssue = async (
  machineName: string,
  issueDescription: string,
  photoBase64?: string,
  language: 'English' | 'Myanmar' = 'English',
  equipmentType: 'Refrigeration' | 'Generator' = 'Refrigeration'
): Promise<string> => {
  const ai = getClient();
  if (!ai) return "System Error: API Key is missing. Please configure in Admin Panel.";

  try {
    const parts: any[] = [];
    
    // Customized prompt based on equipment type
    const roleDescription = equipmentType === 'Generator' 
      ? "expert diesel generator technician" 
      : "expert industrial refrigeration technician";

    let promptText = `You are an ${roleDescription}. 
      A user reported an issue with ${equipmentType} unit "${machineName}".
      Issue description: "${issueDescription}".
      
      ${photoBase64 ? "The user has also attached a photo of the issue (see attached)." : ""}
      
      Provide a concise, 3-step troubleshooting guide. Focus on safety and practical immediate actions. 
      If looking at the photo, identify the specific component if possible.`;

    if (language === 'Myanmar') {
      promptText += `\n\nIMPORTANT: Please provide the response in Myanmar language (Burmese). Use clear, professional terminology suitable for technicians.`;
    }

    parts.push({
      text: promptText
    });

    // Add image if provided
    if (photoBase64) {
      // Extract the base64 data part (remove "data:image/jpeg;base64,")
      const base64Data = photoBase64.includes(',') ? photoBase64.split(',')[1] : photoBase64;
      if (base64Data) {
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Data
          }
        });
      }
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts },
    });
    return response.text || "No advice available.";
  } catch (error: any) {
    console.error("Gemini Error:", error);
    return `AI Error: ${error.message || "Connection failed"}`;
  }
};

export const detectAnomaly = async (
  temp: number,
  setpoint: number,
  type: string
): Promise<{ isAnomaly: boolean; message: string }> => {
  const ai = getClient();
  if (!ai) return { isAnomaly: false, message: "" };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Evaluate this refrigeration reading.
      Machine Type: ${type}
      Current Temperature: ${temp}°C
      Setpoint: ${setpoint}°C
      
      Is this a dangerous anomaly that requires immediate attention? Return JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isAnomaly: { type: Type.BOOLEAN },
            message: { type: Type.STRING, description: "Short warning message if anomaly, else 'Normal'" }
          }
        }
      }
    });
    
    let cleanText = response.text || "{}";
    cleanText = cleanText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const json = JSON.parse(cleanText);
    return {
      isAnomaly: json.isAnomaly || false,
      message: json.message || ""
    };
  } catch (error) {
    console.error("Gemini Anomaly Error:", error);
    return { isAnomaly: false, message: "" };
  }
};

export const generateDailyReport = async (records: LogRecord[], machine: Machine): Promise<string> => {
   const ai = getClient();
   if (!ai) return "API Key missing. Please configure in Admin Panel.";
   
   // Filter last 24h
   const recentRecords = records.filter(r => r.machineId === machine.id).slice(-10); // Take last 10 for context

   const prompt = `
     Analyze these recent logs for ${machine.name} (${machine.type}).
     Default Setpoint: ${machine.defaultSetpoint}.
     
     Logs:
     ${JSON.stringify(recentRecords.map(r => {
       if(r.recordType === RecordType.TEMPERATURE) {
         const tr = r as TemperatureRecord;
         return { time: tr.timestamp, temp: tr.currentTemp, setpoint: tr.setpointTemp };
       }
       if(r.recordType === RecordType.MAINTENANCE) {
         const mr = r as MaintenanceRecord;
         return { time: mr.timestamp, issue: mr.issueDescription };
       }
       return { time: r.timestamp, type: r.recordType };
     }))}

     Provide a brief 1-paragraph summary of the machine's health and any recommendations in Myanmar language (Burmese).
   `;

   try {
     const response = await ai.models.generateContent({
       model: "gemini-2.5-flash",
       contents: prompt
     });
     return response.text || "No report generated.";
   } catch (e) {
     return "Error generating report.";
   }
};