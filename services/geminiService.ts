import { GoogleGenAI, Type } from "@google/genai";
import { LogRecord, RecordType, TemperatureRecord, Machine } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const analyzeMaintenanceIssue = async (
  machineName: string,
  issueDescription: string,
  photoBase64?: string,
  language: 'English' | 'Myanmar' = 'English'
): Promise<string> => {
  if (!apiKey) return "API Key not configured.";

  try {
    const parts: any[] = [];
    
    // Add text prompt
    let promptText = `You are an expert industrial refrigeration technician. 
      A user reported an issue with machine "${machineName}".
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
      const base64Data = photoBase64.split(',')[1];
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
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Could not retrieve AI advice at this time.";
  }
};

export const detectAnomaly = async (
  temp: number,
  setpoint: number,
  type: string
): Promise<{ isAnomaly: boolean; message: string }> => {
  if (!apiKey) return { isAnomaly: false, message: "" };

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
    // Remove markdown code blocks if present, just in case
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
   if (!apiKey) return "API Key missing.";
   
   // Filter last 24h
   const recentRecords = records.filter(r => r.machineId === machine.id).slice(-10); // Take last 10 for context

   const prompt = `
     Analyze these recent logs for ${machine.name} (${machine.type}).
     Default Setpoint: ${machine.defaultSetpoint}.
     
     Logs:
     ${JSON.stringify(recentRecords.map(r => {
       if(r.recordType === RecordType.TEMPERATURE) return { time: r.timestamp, temp: r.currentTemp, setpoint: r.setpointTemp };
       return { time: r.timestamp, issue: r.issueDescription };
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