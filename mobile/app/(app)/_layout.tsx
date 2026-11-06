import { AppShell } from '../../src/navigation/AppShell';
import { AreaLayout } from '../../src/navigation/AreaLayout';

export default function AppLayout() {
  return <AreaLayout area="app" shell={AppShell} />;
}
