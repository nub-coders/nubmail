import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function DraftsPage() {
  return (
    <div className="flex flex-col gap-8">
        <div>
            <h1 className="text-3xl font-bold">Drafts</h1>
            <p className="text-muted-foreground">Your saved email drafts.</p>
        </div>
         <Card className="flex-1">
            <CardContent className="p-6 h-96 flex flex-col items-center justify-center text-center">
                <FileText className="h-16 w-16 text-muted-foreground/50 mb-4"/>
                <h3 className="text-xl font-semibold">No Drafts</h3>
                <p className="text-muted-foreground mt-2">Emails you save as drafts will appear here.</p>
            </CardContent>
        </Card>
    </div>
  );
}
