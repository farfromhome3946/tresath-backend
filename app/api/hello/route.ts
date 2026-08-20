import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    status: "success", 
    message: "Welcome to the Tresath Backend API!" 
  });
}

