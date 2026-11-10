import { ToolUpload } from "@/components/shared/tool-upload";

export default function PassportPhotoPage() {
  return <ToolUpload
    toolId="passport-photo"
    title="Passport Size Photo Maker"
    subtitle="Create and print passport size photos in standard layouts"
    uploadHeading="Upload Passport Photo"
    acceptedFormats={[".jpg", ".png", ".jpeg"]}
    multiple={false}
  />;
}
