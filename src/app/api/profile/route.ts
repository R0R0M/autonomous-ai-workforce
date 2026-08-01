import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/auth";
import { db } from "@/lib/db";

const ProfileSchema = z.object({
  name: z.string().trim().min(1).max(60),
});

export async function PATCH(req: Request) {
  const userId = await requireUserId();
  const body = ProfileSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "Name must be 1-60 characters" }, { status: 400 });
  }
  await db.user.update({ where: { id: userId }, data: { name: body.data.name } });
  return NextResponse.json({ ok: true });
}
