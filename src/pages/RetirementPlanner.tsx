import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

export default function RetirementPlanner() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Retirement Planner</h1>
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="text-lg">Coming Soon</CardTitle>
            <CardDescription>Retirement planning tools will live here.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() =>
                window.open(
                  "https://id-preview--7603bb84-a88e-44af-8ef0-da322e6bf4aa.lovable.app/retirement-planner",
                  "_blank"
                )
              }
            >
              Open Retirement Journey Planner
              <ExternalLink className="ml-1 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
