import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { plan, amount } = await req.json();

        // Generates a valid-looking structure for the frontend
        const mockOrderId = `order_${Math.random().toString(36).substring(2, 11)}`;

        return NextResponse.json({
            orderId: mockOrderId,
            amount: amount * 100 // Razorpay processes in paise
        });
    } catch (error: any) {
        console.error("Razorpay Order Error:", error);
        return NextResponse.json({ error: "Failed to create payment order" }, { status: 500 });
    }
}