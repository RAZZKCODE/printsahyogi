import { ToolUpload } from "@/components/shared/tool-upload";

export default function PostcardPhotoPage() {
  return <ToolUpload
    toolId="postcard-photo"
    title="Postcard Size Photo Maker"
    subtitle="Create and print postcard size photos — 2 per A4 sheet (one per row) or 1 per 4×6 paper"
    uploadHeading="Upload Postcard Photo"
    acceptedFormats={[".jpg", ".png", ".jpeg", ".webp"]}
    multiple
  />;
}
