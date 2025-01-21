import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose, 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from 'lucide-react';
import { sendNewGmailMessage } from '@/lib/supabaseClient'; 

interface ComposeEmailDialogProps {
  children: React.ReactNode; 
}

const ComposeEmailDialog: React.FC<ComposeEmailDialogProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    if (!to.trim()) {
      toast({
        title: "Missing Recipient",
        description: "Please enter at least one recipient.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);

    try {
      const success = await sendNewGmailMessage(to, subject, body);

      if (success) {
        toast({
          title: "Success",
          description: "Email sent successfully!",
        });
        setIsOpen(false); 
        setTimeout(() => {
            setTo('');
            setSubject('');
            setBody('');
        }, 300);
      }
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast({
        title: "Error Sending Email",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  // Reset fields when dialog is closed manually
  const handleOpenChange = (open: boolean) => {
    if (!open) {
        // Reset fields if dialog is closed without sending
        setTo('');
        setSubject('');
        setBody('');
    }
    setIsOpen(open);
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Compose New Email</DialogTitle>
          <DialogDescription>
            Fill in the details below to send a new email.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="to" className="text-right">
              To
            </Label>
            <Input
              id="to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="col-span-3"
              disabled={isSending}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="subject" className="text-right">
              Subject
            </Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              className="col-span-3"
              disabled={isSending}
            />
          </div>
          <div className="grid grid-cols-1 gap-2">
            <Label htmlFor="body" className="sr-only">
              Body
            </Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your message here..."
              className="min-h-[200px] resize-y" 
              disabled={isSending}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleSend}
            disabled={isSending}
            className="bg-purple hover:bg-purple/90"
          >
            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isSending ? 'Sending...' : 'Send Email'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ComposeEmailDialog;
