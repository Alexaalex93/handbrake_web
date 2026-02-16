import { NextRequest, NextResponse } from "next/server"
import { getScanProgress } from "../route"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const progress = getScanProgress(Number(id))

  if (!progress) {
    return NextResponse.json({ status: "idle" })
  }

  return NextResponse.json(progress)
}
