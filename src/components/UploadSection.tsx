import React, { useState, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Loader, CheckCircle, FileText, Brain } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as mammoth from 'mammoth';
import { createWorker } from 'tesseract.js';

interface UploadSectionProps {
  classId?: string;
}

const UploadSection: React.FC<UploadSectionProps> = ({ classId }) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [extractionMethod, setExtractionMethod] = useState<'server' | 'local' | 'text'>('local');
  const [localProgress, setLocalProgress] = useState<string>('');
  const [useLocalOCR, setUseLocalOCR] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (validateFile(file)) {
        uploadAndProcessFile(file);
      }
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        uploadAndProcessFile(file);
      }
    }
  }, []);

  const validateFile = (file: File): boolean => {
    const supportedTypes = [
      'application/pdf',
      'text/plain', 
      'text/markdown',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (!supportedTypes.includes(file.type) && !file.name.match(/\.(txt|md|docx)$/i)) {
      toast.error('Supported formats: PDF, TXT, MD, DOCX');
      return false;
    }
    
    if (file.size > 20 * 1024 * 1024) { // 20MB limit
      toast.error('File size must be less than 20MB');
      return false;
    }
    
    return true;
  };

  const extractTextFromDocx = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  };

  const extractTextLocally = async (file: File): Promise<string> => {
    setLocalProgress('Starting local text extraction...');
    
    if (file.type === 'text/plain') {
      return await file.text();
    }
    
    if (file.name.endsWith('.md')) {
      return await file.text();
    }
    
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      setLocalProgress('Extracting text from DOCX...');
      return await extractTextFromDocx(file);
    }
    
    if (file.type === 'application/pdf') {
      setLocalProgress('Extracting text from PDF...');
      
      // Use PDF.js in browser
      const arrayBuffer = await file.arrayBuffer();
      
      // Import PDF.js dynamically
      const pdfjsLib = await import('pdfjs-dist');
      
      // Set worker source to use the bundled worker
      const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.min.js?url');
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker.default;
      
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let extractedText = '';
      let pagesWithText = 0;
      let pagesNeedingOCR = [];
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        setLocalProgress(`Processing page ${pageNum}/${pdf.numPages}...`);
        
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ')
          .trim();
        
        if (pageText && pageText.length > 10) {
          extractedText += `\n\n--- Page ${pageNum} ---\n${pageText}`;
          pagesWithText++;
        } else {
          pagesNeedingOCR.push(pageNum);
        }
      }
      
      // OCR fallback for pages without text
      if (useLocalOCR && pagesNeedingOCR.length > 0) {
        setLocalProgress(`Running OCR on ${pagesNeedingOCR.length} pages...`);
        
        const worker = await createWorker('eng');
        
        for (const pageNum of pagesNeedingOCR) {
          try {
            setLocalProgress(`OCR processing page ${pageNum}...`);
            
            const page = await pdf.getPage(pageNum);
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d')!;
            const viewport = page.getViewport({ scale: 2.0 });
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            await page.render({
              canvasContext: context,
              viewport: viewport,
              canvas: canvas
            }).promise;
            
            const { data: { text } } = await worker.recognize(canvas);
            
            if (text.trim()) {
              extractedText += `\n\n--- Page ${pageNum} (OCR) ---\n${text}`;
            }
          } catch (ocrError) {
            console.error(`OCR failed for page ${pageNum}:`, ocrError);
          }
        }
        
        await worker.terminate();
      }
      
      setLocalProgress(`Completed: ${pagesWithText} pages extracted, ${pagesNeedingOCR.length} ${useLocalOCR ? 'OCR processed' : 'skipped'}`);
      
      return extractedText || `No text could be extracted from ${file.name}`;
    }
    
    throw new Error('Unsupported file type for local extraction');
  };

  const processTextDirectly = async (text: string, filename: string, method: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Please sign in to process files');
      return;
    }

    setProcessing(true);
    toast.info('Processing text content...');

    try {
      const { data: processData, error: processError } = await supabase.functions.invoke('ingest-text', {
        body: { 
          text, 
          filename,
          extractionMethod: method
        },
      });

      if (processError) {
        console.error('Text processing error:', processError);
        toast.error(`Processing failed: ${processError.message}`);
        return;
      }

      setUploadedFile(filename);
      toast.success(`Successfully processed ${filename}!`);
      
    } catch (error) {
      console.error('Error processing text:', error);
      toast.error('Processing failed. Please try again.');
    } finally {
      setProcessing(false);
      setLocalProgress('');
    }
  };

  const uploadAndProcessFile = async (file: File) => {
    if (!validateFile(file)) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Please sign in to upload files');
      return;
    }

    try {
      // Handle text-based files directly
      if (extractionMethod === 'text' || file.type !== 'application/pdf') {
        const text = await extractTextLocally(file);
        await processTextDirectly(text, file.name, 'direct');
        return;
      }

      // Handle local extraction
      if (extractionMethod === 'local') {
        const text = await extractTextLocally(file);
        await processTextDirectly(text, file.name, 'local');
        return;
      }

      // Handle server-side PDF processing (original method)
      setUploading(true);
      toast.info('Uploading file...');

      const formData = new FormData();
      formData.append('file', file);

      const { data: uploadData, error: uploadError } = await supabase.functions.invoke('upload-pdf', {
        body: formData,
      });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error(`Upload failed: ${uploadError.message}`);
        return;
      }

      if (!uploadData?.filePath) {
        toast.error('Upload failed: No file path returned');
        return;
      }

      setUploading(false);
      setProcessing(true);
      toast.info('Processing PDF on server...');

      const { data: processData, error: processError } = await supabase.functions.invoke('process-pdf', {
        body: { 
          filePath: uploadData.filePath, 
          filename: file.name 
        },
      });

      if (processError) {
        console.error('Processing error:', processError);
        
        // Check if it's the "server unavailable" error and fallback to local extraction
        if (processError.message && processError.message.includes('Server extraction unavailable')) {
          console.log('Server extraction unavailable, falling back to local extraction...');
          toast.info('Server extraction unavailable, using local extraction instead');
          
          // Fallback to local extraction
          setProcessing(true);
          toast.info('Processing text content...');
          const text = await extractTextLocally(file);
          await processTextDirectly(text, file.name, 'local');
          return;
        } else {
          toast.error(`Processing failed: ${processError.message}`);
          return;
        }
      }

      setUploadedFile(file.name);
      toast.success(`Successfully processed ${file.name}!`);
      
    } catch (error) {
      console.error('Error processing file:', error);
      toast.error('Processing failed. Please try again.');
    } finally {
      setUploading(false);
      setProcessing(false);
      setLocalProgress('');
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <section className="py-16 bg-gradient-to-br from-background to-muted/30">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold heading-gradient mb-4">
            Upload Your Course Materials
          </h2>
          <p className="text-lg text-muted-foreground">
            Upload documents (PDF, TXT, MD, DOCX) to make them searchable by the AI tutor
          </p>
          
          {/* Extraction Method Selection */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-3 mt-8 max-w-2xl mx-auto">
            <h3 className="font-medium text-sm text-foreground">Processing Method:</h3>
            <div className="flex flex-col sm:flex-row gap-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="extraction"
                  value="server"
                  checked={extractionMethod === 'server'}
                  onChange={(e) => setExtractionMethod(e.target.value as any)}
                  className="text-primary"
                />
                <span>Server (fast, PDF only)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="extraction"
                  value="local"
                  checked={extractionMethod === 'local'}
                  onChange={(e) => setExtractionMethod(e.target.value as any)}
                  className="text-primary"
                />
                <span>Local extraction (all formats)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="extraction"
                  value="text"
                  checked={extractionMethod === 'text'}
                  onChange={(e) => setExtractionMethod(e.target.value as any)}
                  className="text-primary"
                />
                <span>Direct text (TXT, MD, DOCX)</span>
              </label>
            </div>
            
            {extractionMethod === 'local' && (
              <div className="pt-2 border-t border-border">
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={useLocalOCR}
                    onChange={(e) => setUseLocalOCR(e.target.checked)}
                    className="text-primary"
                  />
                  <span>Use local OCR for scanned pages (slow)</span>
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-2xl mx-auto">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.docx"
            onChange={handleFileChange}
            className="hidden"
            disabled={uploading || processing}
          />
          
          <Card 
            className={`p-8 border-2 border-dashed transition-all duration-300 ${
              dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            } ${uploading || processing ? 'opacity-50' : 'cursor-pointer hover:border-primary/50'}`}
            onDragEnter={!uploading && !processing ? handleDrag : undefined}
            onDragLeave={!uploading && !processing ? handleDrag : undefined}
            onDragOver={!uploading && !processing ? handleDrag : undefined}
            onDrop={!uploading && !processing ? handleDrop : undefined}
            onClick={!uploading && !processing ? openFileDialog : undefined}
          >
            {processing ? (
              <div className="text-center space-y-4">
                <Loader className="h-12 w-12 animate-spin text-primary mx-auto" />
                <div>
                  <p className="text-lg font-medium text-foreground">
                    {extractionMethod === 'local' ? 'Extracting text locally...' : 'Processing document...'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {localProgress || 'This may take a few minutes'}
                  </p>
                </div>
              </div>
            ) : uploadedFile ? (
              <div className="text-center space-y-4">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                <div>
                  <p className="text-lg font-medium text-foreground">Processing Complete!</p>
                  <p className="text-sm text-muted-foreground">
                    {uploadedFile} is now available for AI tutoring
                  </p>
                </div>
                <Button 
                  onClick={() => setUploadedFile(null)}
                  className="mt-4"
                >
                  Upload Another Document
                </Button>
              </div>
            ) : uploading ? (
              <div className="text-center space-y-4">
                <Loader className="h-12 w-12 animate-spin text-primary mx-auto" />
                <div>
                  <p className="text-lg font-medium text-foreground">Uploading...</p>
                  <p className="text-sm text-muted-foreground">Please wait while we upload your file</p>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-6">
                <Upload className="h-12 w-12 text-muted-foreground mx-auto" />
                <div>
                  <h3 className="text-xl font-semibold mb-2">Drop your document here</h3>
                  <p className="text-muted-foreground mb-4">
                    or click to browse from your computer
                  </p>
                </div>
                
                <Button 
                  onClick={openFileDialog}
                  className="w-full max-w-xs"
                  disabled={uploading || processing}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose Document
                </Button>
              </div>
            )}
          </Card>

          <div className="text-center mt-6">
            <p className="text-xs text-muted-foreground">
              Maximum file size: 20MB • Supported formats: PDF, TXT, MD, DOCX
            </p>
            {extractionMethod === 'local' && (
              <p className="text-xs text-amber-600 mt-1">
                Local processing may take several minutes for large PDFs
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default UploadSection;