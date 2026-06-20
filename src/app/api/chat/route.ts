import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

// Initialize the Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
    try {
        const { message, shopContext } = await req.json();

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({
                error: "System Configuration Error: AI module is currently offline."
            }, { status: 500 });
        }

        // We inject the live database data into the AI's brain as a native system instruction
        const systemInstruction = `
            You are 'StockEasy AI', a highly intelligent, professional, and concise virtual assistant for a pharmacy manager. 
            Here is the live data for the pharmacy right now:
            
            ${shopContext}
            
            MANDATORY GUARDRAILS & FORMATTING RULES:
            1. Answer ONLY using the provided database data. Do not make up inventory, dealers, or sales data.
            2. FORMATTING STRICT RULE: NEVER use Markdown formatting. Do NOT use asterisks (**) for bolding. Do NOT use hashtags (#) for headers. 
            3. Use plain text formatting only. Use capital letters for emphasis if needed. Use standard dashes (-) for bullet points, and use line breaks (newlines) to separate sections clearly so it is easy to read in a standard chat window.
            4. Be highly professional, analytical, and structured—like an enterprise SaaS assistant (e.g., Zoho or Odoo).
            5. If the user asks for medical advice, immediately refuse and state: "I am a pharmacy management tool, not a doctor. Please consult a medical professional."
            6. If the user asks about data not in the context, state: "I do not currently have access to that specific metric in your database records."
            7. Provide precise numbers, quantities, and dealer names exactly as they appear in the data.
        `;

        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            systemInstruction: systemInstruction
        });

        const result = await model.generateContent(message);
        const response = await result.response;
        const text = response.text();

        return NextResponse.json({ text });

    } catch (error: any) {
        console.error("Gemini API Error:", error);

        // INTERCEPT GOOGLE API ERRORS (Like the 503 High Demand Error)
        let friendlyError = "The StockEasy AI engine is currently processing a high volume of requests. Please try your query again in a few moments.";

        if (error?.message?.includes("503") || error?.message?.includes("overloaded")) {
            friendlyError = "The AI Analytics engine is currently at peak capacity. Please allow a few moments and try your request again.";
        }

        return NextResponse.json({ error: friendlyError }, { status: 503 });
    }
}