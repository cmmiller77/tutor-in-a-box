import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Upload, FileText, CheckCircle, Loader2, AlertCircle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/integrations/supabase/client"
import uploadIcon from "@/assets/upload-icon.jpg"

const UploadSection = () => {
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

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

  const handleFiles = async (files: FileList) => {
    const file = files[0]
    
    // Validate file type
    if (file.type !== 'application/pdf') {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file only.",
        variant: "destructive",
      })
      return
    }

    // Validate file size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 20MB.",
        variant: "destructive",
      })
      return
    }

    await uploadAndProcessFile(file)
  }

  const uploadAndProcessFile = async (file: File) => {
    try {
      setUploading(true)
      
      // Get the session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        throw new Error('Please sign in to upload files')
      }

      // Upload file
      const formData = new FormData()
      formData.append('file', file)

      const uploadResponse = await supabase.functions.invoke('upload-pdf', {
        body: formData,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (uploadResponse.error) {
        throw new Error(uploadResponse.error.message || 'Failed to upload file')
      }

      const uploadData = uploadResponse.data
      console.log('Upload successful:', uploadData)

      setUploading(false)
      setProcessing(true)
      setUploadedFile(file.name)

      toast({
        title: "File uploaded successfully",
        description: "Processing PDF and generating embeddings...",
      })

      // Process PDF
      const processResponse = await supabase.functions.invoke('process-pdf', {
        body: {
          filePath: uploadData.filePath,
          filename: file.name
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (processResponse.error) {
        throw new Error(processResponse.error.message || 'Failed to process PDF')
      }

      console.log('Processing successful:', processResponse.data)

      toast({
        title: "PDF processed successfully",
        description: `Generated embeddings for ${processResponse.data.chunksProcessed} text chunks. You can now ask questions about your document!`,
      })

      setProcessing(false)

    } catch (error) {
      console.error('Error uploading/processing file:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload and process file",
        variant: "destructive",
      })
      setUploading(false)
      setProcessing(false)
      setUploadedFile(null)
    }
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
            accept=".pdf"
            onChange={handleFileChange}
            className="hidden"
            disabled={uploading || processing}
          />
          <Card 
            className={`upload-area ${dragActive ? 'border-primary bg-primary/5' : ''} ${uploading || processing ? 'opacity-50' : 'cursor-pointer'} transition-all duration-300`}
            onDragEnter={!uploading && !processing ? handleDrag : undefined}
            onDragLeave={!uploading && !processing ? handleDrag : undefined}
            onDragOver={!uploading && !processing ? handleDrag : undefined}
            onDrop={!uploading && !processing ? handleDrop : undefined}
            onClick={!uploading && !processing ? openFileDialog : undefined}
          >
            <div className="flex flex-col items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                {uploading || processing ? (
                  <Loader2 className="w-12 h-12 animate-spin text-primary" />
                ) : uploadedFile ? (
                  <CheckCircle className="w-12 h-12 text-green-500" />
                ) : (
                  <img src={uploadIcon} alt="Upload" className="w-12 h-12 object-contain" />
                )}
              </div>
              
              <div className="text-center">
                {uploading ? (
                  <>
                    <h3 className="text-xl font-semibold mb-2">Uploading PDF...</h3>
                    <p className="text-muted-foreground mb-4">
                      Please wait while we upload your file
                    </p>
                  </>
                ) : processing ? (
                  <>
                    <h3 className="text-xl font-semibold mb-2">Processing PDF...</h3>
                    <p className="text-muted-foreground mb-4">
                      Extracting text and generating embeddings
                    </p>
                  </>
                ) : uploadedFile ? (
                  <>
                    <h3 className="text-xl font-semibold mb-2 text-green-600">Ready!</h3>
                    <p className="text-muted-foreground mb-4">
                      {uploadedFile} has been processed successfully
                    </p>
                    <Button variant="outline" onClick={() => { setUploadedFile(null); openFileDialog(); }}>
                      <Upload className="w-5 h-5 mr-2" />
                      Upload Another PDF
                    </Button>
                  </>
                ) : (
                  <>
                    <h3 className="text-xl font-semibold mb-2">Drop your PDF here</h3>
                    <p className="text-muted-foreground mb-4">
                      or click to browse from your computer
                    </p>
                    <Button variant="hero" size="lg" onClick={openFileDialog}>
                      <Upload className="w-5 h-5 mr-2" />
                      Choose PDF File
                    </Button>
                  </>
                )}
              </div>

              {!uploading && !processing && !uploadedFile && (
                <div className="flex items-center gap-8 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    <span>PDFs Only</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>Max 20MB</span>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Upload a PDF textbook or course material to get started with AI-powered learning
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default UploadSection