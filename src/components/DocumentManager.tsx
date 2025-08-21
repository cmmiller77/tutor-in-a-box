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
  filename: string;
  title: string;
  content: string;
  file_size: number;
  page_count: number;
  created_at: string;
  user_id: string;
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

      if (classId) {
        // Get documents linked to this specific class - two-step process for reliability
        const { data: classDocuments, error: classError } = await supabase
          .from('class_documents')
          .select('document_id')
          .eq('class_id', classId);

        if (classError) {
          console.error('Error fetching class documents:', classError);
          return;
        }

        if (classDocuments && classDocuments.length > 0) {
          const documentIds = classDocuments.map(cd => cd.document_id);
          
          const { data: documents, error: docsError } = await supabase
            .from('documents')
            .select('id, filename, title, content, file_size, page_count, created_at, user_id')
            .in('id', documentIds)
            .order('created_at', { ascending: false });

          if (docsError) {
            console.error('Error fetching documents:', docsError);
            return;
          }

          setDocuments(documents || []);
        } else {
          setDocuments([]);
        }
      } else {
        // Get all documents for the user
        const { data, error } = await supabase
          .from('documents')
          .select('id, filename, title, content, file_size, page_count, created_at, user_id')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching documents:', error);
          return;
        }

        setDocuments(data || []);
      }
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

  const deleteDocument = async (documentId: string, filename: string) => {
    try {
      setDeletingId(documentId);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please sign in to delete documents');
      }

      if (classId) {
        // If viewing class documents, just unlink from class (don't delete the document entirely)
        const { error: unlinkError } = await supabase
          .from('class_documents')
          .delete()
          .eq('class_id', classId)
          .eq('document_id', documentId);

        if (unlinkError) {
          throw new Error('Failed to remove document from class');
        }

        toast({
          title: "Document removed from class",
          description: "The document has been removed from this class.",
        });
      } else {
        // If viewing user's library, delete the document entirely
        const { error: docError } = await supabase
          .from('documents')
          .delete()
          .eq('id', documentId)
          .eq('user_id', session.user.id);

        if (docError) {
          throw new Error('Failed to delete document');
        }

        // Try to delete the file from storage (best effort)
        try {
          const filePath = `${session.user.id}/${filename}`;
          await supabase.storage
            .from('pdfs')
            .remove([filePath]);
        } catch (storageError) {
          console.warn('Could not delete file from storage:', storageError);
          // Continue even if storage deletion fails
        }

        toast({
          title: "Document deleted",
          description: "The document has been removed from your library.",
        });
      }

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

  const downloadDocument = async (filename: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please sign in to download documents');
      }

      const filePath = `${session.user.id}/${filename}`;
      
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
      a.download = filename;
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
                key={doc.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">
                      {doc.title || doc.filename}
                    </h4>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{format(new Date(doc.created_at), 'MMM dd, yyyy')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        <span>{doc.page_count} pages</span>
                      </div>
                      {doc.file_size && (
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span>{(doc.file_size / 1024 / 1024).toFixed(1)} MB</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadDocument(doc.filename)}
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
                        disabled={deletingId === doc.id}
                      >
                        <Trash2 className="w-4 h-4" />
                        {deletingId === doc.id ? (classId ? "Removing..." : "Deleting...") : (classId ? "Remove" : "Delete")}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Document</AlertDialogTitle>
                        <AlertDialogDescription>
                          {classId ? (
                            <>
                              Are you sure you want to remove "{doc.title || doc.filename}" from this class? 
                              The document will remain in your library and can be added to other classes.
                            </>
                          ) : (
                            <>
                              Are you sure you want to delete "{doc.title || doc.filename}"? 
                              This will permanently remove the document and all its content ({doc.page_count} pages). 
                              This action cannot be undone.
                            </>
                          )}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteDocument(doc.id, doc.filename)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {classId ? "Remove from Class" : "Delete Document"}
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