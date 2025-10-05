import { Paperclip, Send, Trash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function ComposePage() {
  return (
    <div className="flex flex-col gap-8">
        <div>
            <h1 className="text-3xl font-bold">Compose Email</h1>
            <p className="text-muted-foreground">Draft and send your new message.</p>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>New Message</CardTitle>
            </CardHeader>
            <CardContent>
                <form className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="to">To</Label>
                        <Input id="to" type="email" placeholder="recipient@example.com" />
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="subject">Subject</Label>
                        <Input id="subject" placeholder="Your subject line" />
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="body">Message</Label>
                        <Textarea id="body" placeholder="Write your message here..." className="min-h-[300px]" />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                         <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" type="button">
                                <Paperclip className="h-4 w-4" />
                                <span className="sr-only">Attach file</span>
                            </Button>
                        </div>
                        <div className="flex items-center gap-2">
                             <Button variant="ghost" type="button">
                                <Trash className="mr-2 h-4 w-4" />
                                Discard
                            </Button>
                            <Button type="button">
                                <Send className="mr-2 h-4 w-4" />
                                Send
                            </Button>
                        </div>
                    </div>
                </form>
            </CardContent>
        </Card>
    </div>
  )
}
