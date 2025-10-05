import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Trash2 } from "lucide-react";

export default function TrashPage() {
  return (
    <div className="flex flex-col gap-8">
        <div>
            <h1 className="text-3xl font-bold">Trash</h1>
            <p className="text-muted-foreground">Deleted emails are stored here.</p>
        </div>
         <Card className="flex-1">
            <CardContent className="p-6 h-96 flex flex-col items-center justify-center text-center">
                <Trash2 className="h-16 w-16 text-muted-foreground/50 mb-4"/>
                <h3 className="text-xl font-semibold">Trash is Empty</h3>
                <p className="text-muted-foreground mt-2">When you delete an email, it will appear here.</p>
            </CardContent>
        </Card>
    </div>
  );
}
