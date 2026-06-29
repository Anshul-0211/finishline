import { adminStorage } from "@/lib/firebaseAdmin";
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const userId = formData.get("userId") as string;
    
    if (!file || !userId) {
      return NextResponse.json({ error: "Missing file or userId" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    try {
      const bucket = adminStorage.bucket();
      const fileName = `uploads/${userId}/${Date.now()}_${file.name}`;
      const storageFile = bucket.file(fileName);

      await storageFile.save(buffer, {
        metadata: {
          contentType: file.type,
        },
      });

      // Make the file readable by generating a signed URL valid for 1 hour
      const [url] = await storageFile.getSignedUrl({
        action: "read",
        expires: Date.now() + 1000 * 60 * 60, // 1 hour
      });

      return NextResponse.json({ fileUrl: url }, { status: 200 });
    } catch (storageErr: any) {
      console.warn("[upload-file] Firebase Storage bucket unavailable. Using local fallback:", storageErr.message);
      
      // Fallback: Save file to local public/uploads directory
      const publicDir = path.join(process.cwd(), "public");
      const uploadsDir = path.join(publicDir, "uploads");
      
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const fileExtension = path.extname(file.name);
      const baseName = path.basename(file.name, fileExtension);
      const safeFileName = `${Date.now()}_${baseName.replace(/[^a-zA-Z0-9]/g, "_")}${fileExtension}`;
      const localFilePath = path.join(uploadsDir, safeFileName);
      
      fs.writeFileSync(localFilePath, buffer);
      
      // Dynamic local URL retrieval
      const origin = req.nextUrl.origin || "http://localhost:3000";
      const localUrl = `${origin}/uploads/${safeFileName}`;
      
      console.log("[upload-file] File saved locally. URL:", localUrl);
      return NextResponse.json({ fileUrl: localUrl }, { status: 200 });
    }
  } catch (err: any) {
    console.error("[upload-file] Failed to save/upload file:", err);
    return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
