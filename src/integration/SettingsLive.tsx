import { Card } from "../components/ui";
import { AssignmentSettings } from "./AssignmentSettings";

export function SettingsLive() {
  return (
    <div className="form-stack settings-page">
      <Card className="settings-tabs">
        <span className="assignment-section-label">Asignación</span>
      </Card>
      <AssignmentSettings />
    </div>
  );
}
