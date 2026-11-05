import React from 'react';
import {
  CausalChainProvider,
  useCausalChain,
} from './hooks/useCausalChainStore';
import { MainLayout } from './layouts/MainLayout';
import { OverviewPage } from './pages/OverviewPage';
import { LiveExplorerPage } from './pages/LiveExplorerPage';
import { EvidenceAcquisitionPage } from './pages/EvidenceAcquisitionPage';
import { CorrelationPage } from './pages/CorrelationPage';
import { DisagreementPage } from './pages/DisagreementPage';
import { CompletenessPage } from './pages/CompletenessPage';
import { CausalGraphPage } from './pages/CausalGraphPage';
import { BoundaryPage } from './pages/BoundaryPage';
import { ReconstructionPage } from './pages/ReconstructionPage';
import { CryptographyPage } from './pages/CryptographyPage';
import { CertificatesPage } from './pages/CertificatesPage';
import { ValidatorsPage } from './pages/ValidatorsPage';
import { ExperimentsBenchmarksPage } from './pages/ExperimentsBenchmarksPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { DocumentationPage } from './pages/DocumentationPage';
import { SettingsPage } from './pages/SettingsPage';

const ActivePageRouter: React.FC = () => {
  const { activePage } = useCausalChain();

  switch (activePage) {
    case 'overview':
      return <OverviewPage />;
    case 'explorer':
      return <LiveExplorerPage />;
    case 'evidence':
      return <EvidenceAcquisitionPage />;
    case 'correlation':
      return <CorrelationPage />;
    case 'disagreement':
      return <DisagreementPage />;
    case 'completeness':
      return <CompletenessPage />;
    case 'causal-graph':
      return <CausalGraphPage />;
    case 'boundary':
      return <BoundaryPage />;
    case 'reconstruction':
      return <ReconstructionPage />;
    case 'cryptography':
      return <CryptographyPage />;
    case 'certificates':
      return <CertificatesPage />;
    case 'validators':
      return <ValidatorsPage />;
    case 'experiments':
      return <ExperimentsBenchmarksPage />;
    case 'audit':
      return <AuditLogsPage />;
    case 'documentation':
      return <DocumentationPage />;
    case 'settings':
      return <SettingsPage />;
    default:
      return <OverviewPage />;
  }
};

export function App() {
  return (
    <CausalChainProvider>
      <MainLayout>
        <ActivePageRouter />
      </MainLayout>
    </CausalChainProvider>
  );
}

export default App;
