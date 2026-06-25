import { useMemo, useState } from 'react';
import { CalendarView } from './components/CalendarView';
import { ComparisonTable } from './components/ComparisonTable';
import { CreateMasterModal } from './components/CreateMasterModal';
import { ErrorAlert } from './components/ErrorAlert';
import { FileChangeModal } from './components/FileChangeModal';
import { FileStatusBar } from './components/FileStatusBar';
import { GridView } from './components/GridView';
import { Header } from './components/Header';
import { MasterView } from './components/MasterView';
import { PlanningFiltersBar } from './components/PlanningFiltersBar';
import { PlannerView } from './components/PlannerView';
import { SideMenu } from './components/SideMenu';
import { SummaryBar } from './components/SummaryBar';
import type { TabKey } from './components/Tabs';
import { TrackingProjectView } from './components/TrackingProjectView';
import { useFilteredRows, useFilterOptions } from './hooks/useFilteredRows';
import { useMasterWorkbook } from './hooks/useMasterWorkbook';
import { usePlannerWorkbook } from './hooks/usePlannerWorkbook';
import { applyMasterChanges, buildMasterChangeCandidates, validateMasterProject } from './services/masterExcel';
import { rowsFromMasterCandidates, rowsFromPlannerSheet } from './services/masterComparisonView';
import { getGeneratedExcelFileName } from './utils/generatedExcel';
import { initialPlanningFilters } from './utils/planningFilters';

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function App() {
  const planner = usePlannerWorkbook();
  const master = useMasterWorkbook();
  const [filters, setFilters] = useState(initialPlanningFilters);
  const [activeTab, setActiveTab] = useState<TabKey>('excel');
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [lastLoadAt, setLastLoadAt] = useState<Date | null>(null);
  const [masterVersion, setMasterVersion] = useState(0);
  const [isCreatingMaster, setIsCreatingMaster] = useState(false);
  const [workspaceMessage, setWorkspaceMessage] = useState<string | null>(null);

  const plannerRows = useMemo(() => rowsFromPlannerSheet(planner.parsedSheet), [planner.parsedSheet]);
  const plannerProjectName = planner.parsedSheet?.projectName ?? '';
  const validation = useMemo(
    () => validateMasterProject(master.workbook, plannerProjectName),
    [master.workbook, masterVersion, plannerProjectName],
  );
  const masterCandidates = useMemo(
    () => buildMasterChangeCandidates(master.workbook, plannerRows, plannerProjectName),
    [master.workbook, masterVersion, plannerProjectName, plannerRows],
  );
  const displayRows = useMemo(
    () => (master.workbook ? rowsFromMasterCandidates(masterCandidates) : plannerRows),
    [master.workbook, masterCandidates, plannerRows],
  );
  const { projectOptions, assigneeOptions } = useFilterOptions(displayRows);
  const filteredRows = useFilteredRows(displayRows, filters);
  const currentColumns = planner.parsedSheet?.columns.visibleColumns ?? [];
  const readyCandidates = masterCandidates.filter((candidate) => candidate.status === 'ready');
  const unmatchedCount = masterCandidates.filter((candidate) => candidate.status === 'not_found').length;
  const ambiguousCount = masterCandidates.filter((candidate) => candidate.status === 'ambiguous').length;
  const canStartMasterFlow = planner.isReady && master.isReady;
  const canCreateMasterCopy = validation.status === 'valid' && readyCandidates.length > 0;
  const hasAnyError = Boolean(planner.error || master.error);

  const handlePlannerFileSelected = async (file: File): Promise<void> => {
    await planner.loadPlannerFile(file);
    setLastLoadAt(new Date());
    setFilters(initialPlanningFilters);
    setWorkspaceMessage(null);
  };

  const handleMasterFileSelected = async (file: File): Promise<void> => {
    await master.loadMasterFile(file);
    setLastLoadAt(new Date());
    setMasterVersion((version) => version + 1);
    setWorkspaceMessage(null);
  };

  const handleCreateMasterCopy = async (): Promise<void> => {
    if (!master.workbook || !canCreateMasterCopy) {
      return;
    }

    setIsCreatingMaster(true);
    try {
      const blob = await applyMasterChanges(master.workbook, readyCandidates);
      downloadBlob(blob, getGeneratedExcelFileName());
      setMasterVersion((version) => version + 1);
      setWorkspaceMessage(`Copia actualizada creada con ${readyCandidates.length} cambio(s) validado(s).`);
      setIsCreateModalOpen(false);
    } catch {
      setWorkspaceMessage('No se ha podido crear el Excel maestro actualizado.');
    } finally {
      setIsCreatingMaster(false);
    }
  };

  const renderEmptyStart = () => (
    <section className="empty-state workspace-empty">
      <h2>Carga tus archivos para empezar</h2>
      <p>Sube el Excel exportado de Planner y el Excel maestro para revisar cambios y crear una copia actualizada.</p>
      <div className="empty-actions">
        <button className="primary-button" type="button" onClick={() => setIsFileModalOpen(true)}>
          Cargar archivos
        </button>
      </div>
    </section>
  );

  const renderExcelWorkspace = () => {
    if (!planner.parsedSheet) {
      return renderEmptyStart();
    }

    return (
      <>
        <PlanningFiltersBar
          filters={filters}
          projectOptions={projectOptions}
          assigneeOptions={assigneeOptions}
          onFiltersChange={setFilters}
          onClearFilters={() => setFilters(initialPlanningFilters)}
        />
        <section className="results-panel">
          <SummaryBar
            visibleCount={filteredRows.visibleCount}
            changedCount={filteredRows.changedCount}
            unmatchedCount={filteredRows.unmatchedCount}
          />
          <ComparisonTable rows={filteredRows.rows} columns={currentColumns} />
        </section>
      </>
    );
  };

  const renderActiveView = () => {
    if (activeTab === 'planner') {
      return <PlannerView rows={displayRows} />;
    }

    if (activeTab === 'grid') {
      return (
        <GridView
          rows={plannerRows}
          masterWorkbook={master.workbook}
          plannerProjectName={plannerProjectName}
          onMasterUpdated={() => setMasterVersion((version) => version + 1)}
        />
      );
    }

    if (activeTab === 'calendar') {
      if (!planner.parsedSheet) {
        return renderEmptyStart();
      }

      return (
        <>
          <PlanningFiltersBar
            filters={filters}
            projectOptions={projectOptions}
            assigneeOptions={assigneeOptions}
            onFiltersChange={setFilters}
            onClearFilters={() => setFilters(initialPlanningFilters)}
          />
          <CalendarView rows={filteredRows.rows} />
        </>
      );
    }

    if (activeTab === 'master') {
      return (
        <MasterView
          candidates={masterCandidates}
          masterWorkbook={master.workbook}
        />
      );
    }

    if (activeTab === 'tracking-excel') {
      return <TrackingProjectView masterWorkbook={master.workbook} viewMode="excel" />;
    }

    if (activeTab === 'tracking-planner') {
      return <TrackingProjectView masterWorkbook={master.workbook} viewMode="planner" />;
    }

    if (activeTab === 'tracking-grid') {
      return <TrackingProjectView masterWorkbook={master.workbook} viewMode="grid" />;
    }

    if (activeTab === 'tracking-calendar') {
      return <TrackingProjectView masterWorkbook={master.workbook} viewMode="calendar" />;
    }

    return renderExcelWorkspace();
  };

  return (
    <div className="app">
      <Header
        canCreateMaster={canStartMasterFlow}
        onCreateMaster={() => setIsCreateModalOpen(true)}
        onOpenMenu={() => setIsSideMenuOpen(true)}
      />

      <main>
        <FileStatusBar
          plannerFileName={planner.fileName}
          plannerReady={planner.isReady}
          masterFileName={master.fileName}
          masterReady={master.isReady}
          lastLoadAt={lastLoadAt}
          onChangeFiles={() => setIsFileModalOpen(true)}
        />

        {(planner.isProcessing || master.isProcessing) && (
          <section className="state-strip" aria-live="polite">
            <span className="state-pill">Procesando archivos Excel</span>
          </section>
        )}

        {workspaceMessage && <p className="grid-message is-success">{workspaceMessage}</p>}

        {hasAnyError && (
          <div className="error-stack">
            {planner.error && <ErrorAlert message={planner.error} />}
            {master.error && <ErrorAlert message={master.error} />}
          </div>
        )}

        {renderActiveView()}
      </main>

      <FileChangeModal
        isOpen={isFileModalOpen}
        plannerFileName={planner.fileName}
        plannerReady={planner.isReady}
        plannerError={planner.error}
        masterFileName={master.fileName}
        masterReady={master.isReady}
        masterError={master.error}
        onPlannerFileSelected={(file) => void handlePlannerFileSelected(file)}
        onMasterFileSelected={(file) => void handleMasterFileSelected(file)}
        onClose={() => setIsFileModalOpen(false)}
      />

      <CreateMasterModal
        isOpen={isCreateModalOpen}
        plannerFileName={planner.fileName}
        masterFileName={master.fileName}
        projectName={plannerProjectName}
        changedCount={readyCandidates.length}
        unmatchedCount={unmatchedCount}
        ambiguousCount={ambiguousCount}
        canCreate={canCreateMasterCopy}
        isCreating={isCreatingMaster}
        validationMessage={canStartMasterFlow ? validation.message : 'Carga el Excel de Planner actual y el Excel maestro.'}
        onClose={() => setIsCreateModalOpen(false)}
        onConfirm={() => void handleCreateMasterCopy()}
      />

      <SideMenu
        isOpen={isSideMenuOpen}
        activeTab={activeTab}
        onSelect={setActiveTab}
        onClose={() => setIsSideMenuOpen(false)}
      />
    </div>
  );
}

export default App;
