import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Shield } from "lucide-react";

export default function SpamPage() {
  return (
    <div className="flex flex-col gap-8">
        <div>
            <h1 className="text-3xl font-bold">Spam</h1>
            <p className="text-muted-foreground">Emails marked as spam.</p>
        </div>
         <Card className="flex-1">
            <CardContent className="p-6 h-96 flex flex-col items-center justify-center text-center">
                <Shield className="h-16 w-16 text-muted-foreground/50 mb-4"/>
                <h3 className="text-xl font-semibold">Spam Folder is Empty</h3>
                <p className="text-muted-foreground mt-2">Emails identified as spam will be moved here.</p>
            </CardContent>
        </Card>
    </div>
  );
}
