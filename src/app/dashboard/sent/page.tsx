import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Send } from "lucide-react";

export default function SentPage() {
  return (
    <div className="flex flex-col gap-8">
        <div>
            <h1 className="text-3xl font-bold">Sent</h1>
            <p className="text-muted-foreground">A list of all emails you have sent.</p>
        </div>
         <Card className="flex-1">
            <CardContent className="p-6 h-96 flex flex-col items-center justify-center text-center">
                <Send className="h-16 w-16 text-muted-foreground/50 mb-4"/>
                <h3 className="text-xl font-semibold">No Sent Emails</h3>
                <p className="text-muted-foreground mt-2">Emails you send will appear here.</p>
            </CardContent>
        </Card>
    </div>
  );
}
