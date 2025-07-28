import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { FileText, Trash2, Download, Calendar, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface DocumentItem {
  id: string;
  source_file: string;
  created_at: string;
  user_id: string;
  chunk_count: number;
}

interface DocumentManagerProps {
  classId?: string;
}

const DocumentManager = ({ classId }: DocumentManagerProps) => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchDocuments();
  }, [classId]);

  const fetchDocuments = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Get unique documents with chunk counts
      const { data, error } = await supabase
        .from('chunks')
        .select('id, source_file, created_at, user_id')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching documents:', error);
        return;
      }

      // Group by source_file to get unique documents with chunk counts
      const documentMap = new Map<string, DocumentItem>();
      data?.forEach((chunk) => {
        const existing = documentMap.get(chunk.source_file);
        if (existing) {
          existing.chunk_count += 1;
        } else {
          documentMap.set(chunk.source_file, {
            id: chunk.id,
            source_file: chunk.source_file,
            created_at: chunk.created_at,
            user_id: chunk.user_id,
            chunk_count: 1,
          });
        }
      });

      setDocuments(Array.from(documentMap.values()));
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: "Error",
        description: "Failed to load documents.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteDocument = async (sourceFile: string) => {
    try {
      setDeletingId(sourceFile);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please sign in to delete documents');
      }

      // Delete all chunks for this document
      const { error: chunksError } = await supabase
        .from('chunks')
        .delete()
        .eq('source_file', sourceFile)
        .eq('user_id', session.user.id);

      if (chunksError) {
        throw new Error('Failed to delete document chunks');
      }

      // Try to delete the file from storage (best effort)
      try {
        // Extract the file path from source_file if it contains the full path
        const filePath = sourceFile.includes('/') ? sourceFile : `${session.user.id}/${sourceFile}`;
        await supabase.storage
          .from('pdfs')
          .remove([filePath]);
      } catch (storageError) {
        console.warn('Could not delete file from storage:', storageError);
        // Continue even if storage deletion fails
      }

      toast({
        title: "Document deleted",
        description: "The document and all its chunks have been removed.",
      });

      // Refresh the documents list
      await fetchDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete document",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const downloadDocument = async (sourceFile: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please sign in to download documents');
      }

      // Extract the file path from source_file if it contains the full path
      const filePath = sourceFile.includes('/') ? sourceFile : `${session.user.id}/${sourceFile}`;
      
      const { data, error } = await supabase.storage
        .from('pdfs')
        .download(filePath);

      if (error) {
        throw new Error('Failed to download document');
      }

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = sourceFile.split('/').pop() || sourceFile;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Download started",
        description: "Your document download has begun.",
      });
    } catch (error) {
      console.error('Error downloading document:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to download document",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Uploaded Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-lg">Loading documents...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Uploaded Documents
        </CardTitle>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No documents uploaded yet. Use the upload section above to add course materials.
          </div>
        ) : (
          <div className="space-y-4">
            {documents.map((doc) => (
              <div
                key={doc.source_file}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">
                      {doc.source_file.split('/').pop() || doc.source_file}
                    </h4>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{format(new Date(doc.created_at), 'MMM dd, yyyy')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        <span>{doc.chunk_count} chunks</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadDocument(doc.source_file)}
                    className="flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive flex items-center gap-2"
                        disabled={deletingId === doc.source_file}
                      >
                        <Trash2 className="w-4 h-4" />
                        {deletingId === doc.source_file ? "Deleting..." : "Delete"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Document</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{doc.source_file.split('/').pop()}"? 
                          This will remove the document and all associated text chunks ({doc.chunk_count} chunks). 
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteDocument(doc.source_file)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete Document
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DocumentManager;