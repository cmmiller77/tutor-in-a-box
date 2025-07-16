import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Upload, FileText, Image, Film } from "lucide-react"
import uploadIcon from "@/assets/upload-icon.jpg"

const UploadSection = () => {
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files)
    }
  }

  const handleFiles = (files: FileList) => {
    // Handle file upload logic here
    console.log("Files selected:", files)
    Array.from(files).forEach(file => {
      console.log("File:", file.name, "Type:", file.type, "Size:", file.size)
    })
  }

  const openFileDialog = () => {
    fileInputRef.current?.click()
  }

  return (
    <section className="py-16 bg-gradient-to-br from-background to-muted/30">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold heading-gradient mb-4">
            Upload Your Course Materials
          </h2>
          <p className="text-lg text-muted-foreground">
            Simply drag and drop your files or click to browse. Our AI will analyze and create personalized learning content for you.
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.mp4,.mov"
            onChange={handleFileChange}
            className="hidden"
          />
          <Card 
            className={`upload-area ${dragActive ? 'border-primary bg-primary/5' : ''} cursor-pointer transition-all duration-300`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={openFileDialog}
          >
            <div className="flex flex-col items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                <img src={uploadIcon} alt="Upload" className="w-12 h-12 object-contain" />
              </div>
              
              <div className="text-center">
                <h3 className="text-xl font-semibold mb-2">Drop your files here</h3>
                <p className="text-muted-foreground mb-4">
                  or click to browse from your computer
                </p>
                <Button variant="hero" size="lg" onClick={openFileDialog}>
                  <Upload className="w-5 h-5 mr-2" />
                  Choose Files
                </Button>
              </div>

              <div className="flex items-center gap-8 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>PDFs</span>
                </div>
                <div className="flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  <span>Images</span>
                </div>
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4" />
                  <span>Videos</span>
                </div>
              </div>
            </div>
          </Card>

          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Supported formats: PDF, DOC, DOCX, PPT, PPTX, JPG, PNG, MP4, MOV
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default UploadSection