import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
  MarkerType,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toast } from 'sonner';
import { useAppStore } from '../../store/appStore';
import { EmptyState } from '../../components/common/EmptyState';
import { StageNode } from './workflow/nodes/StageNode';
import { StartNode } from './workflow/nodes/StartNode';
import { DoneNode } from './workflow/nodes/DoneNode';
import { AnyNode } from './workflow/nodes/AnyNode';
import { WorkflowToolbar } from './workflow/components/WorkflowToolbar';
import { StageConfigPanel } from './workflow/components/StageConfigPanel';
import { TransitionConfigPanel } from './workflow/components/TransitionConfigPanel';
import { AddStageModal } from './workflow/components/AddStageModal';
import { AddTransitionModal } from './workflow/components/AddTransitionModal';
import {
  workflowToFlowElements,
  getDefaultWorkflowTransitions,
  computeInitialPositions,
  STAGE_TYPE_COLORS,
} from './workflow/workflowUtils';
import type { Workflow, WorkflowStage, WorkflowTransition, WorkflowStageType } from '../../types';

interface WorkflowBuilderProps {
  projectId: string;
  workflowId?: string;
}

const nodeTypes = {
  stageNode: StageNode,
  startNode: StartNode,
  doneNode: DoneNode,
  anyNode: AnyNode,
};

export const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ projectId, workflowId }) => {
  const { workflows, createWorkflow, updateWorkflow, updateProject, projects, teams, users } = useAppStore();

  const workflow = workflows.find((w) => w.id === workflowId || w.projectId === projectId);

  // Local state for interactive canvas
  const [stages, setStages] = useState<WorkflowStage[]>([]);
  const [transitions, setTransitions] = useState<WorkflowTransition[]>([]);
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [workflowStatus, setWorkflowStatus] = useState<'ACTIVE' | 'INACTIVE' | 'DRAFT'>('ACTIVE');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Selection state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Modal dialog states
  const [isAddStageOpen, setIsAddStageOpen] = useState(false);
  const [isAddTransitionOpen, setIsAddTransitionOpen] = useState(false);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Initialize from workflow store
  const initFromWorkflow = useCallback((wf: Workflow) => {
    const initStages = [...wf.stages];
    const initTransitions = wf.transitions && wf.transitions.length > 0
      ? [...wf.transitions]
      : getDefaultWorkflowTransitions(initStages);
    const initPositions = wf.nodePositions && Object.keys(wf.nodePositions).length > 0
      ? { ...wf.nodePositions }
      : computeInitialPositions(initStages);
    const initStatus = wf.status || 'ACTIVE';

    setStages(initStages);
    setTransitions(initTransitions);
    setNodePositions(initPositions);
    setWorkflowStatus(initStatus);
    setHasUnsavedChanges(false);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);

    const { nodes: flowNodes, edges: flowEdges } = workflowToFlowElements(
      { ...wf, stages: initStages, transitions: initTransitions, nodePositions: initPositions, status: initStatus },
      teams,
      users,
      null
    );
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [teams, users, setNodes, setEdges]);

  useEffect(() => {
    if (workflow) {
      initFromWorkflow(workflow);
    }
  }, [workflow?.id, initFromWorkflow]);

  // Sync flow elements when selection or local state changes
  const syncFlowElements = useCallback((
    currentStages: WorkflowStage[],
    currentTransitions: WorkflowTransition[],
    currentPositions: Record<string, { x: number; y: number }>,
    selNodeId: string | null,
    selEdgeId: string | null
  ) => {
    if (!workflow) return;
    const { nodes: flowNodes, edges: flowEdges } = workflowToFlowElements(
      {
        ...workflow,
        stages: currentStages,
        transitions: currentTransitions,
        nodePositions: currentPositions,
      },
      teams,
      users,
      selNodeId || selEdgeId
    );
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [workflow, teams, users, setNodes, setEdges]);

  // Handle node position changes on drag
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);
    let positionChanged = false;
    const updatedPositions = { ...nodePositions };

    changes.forEach((change) => {
      if (change.type === 'position' && change.position) {
        updatedPositions[change.id] = change.position;
        positionChanged = true;
      }
    });

    if (positionChanged) {
      setNodePositions(updatedPositions);
      setHasUnsavedChanges(true);
    }
  }, [nodePositions, onNodesChange]);

  // Handle node selection
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedEdgeId(null);
    setSelectedNodeId(node.id);
    syncFlowElements(stages, transitions, nodePositions, node.id, null);
  }, [stages, transitions, nodePositions, syncFlowElements]);

  // Handle edge selection
  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedNodeId(null);
    setSelectedEdgeId(edge.id);
    syncFlowElements(stages, transitions, nodePositions, null, edge.id);
  }, [stages, transitions, nodePositions, syncFlowElements]);

  // Handle pane click (deselect)
  const onPaneClick = useCallback(() => {
    if (selectedNodeId || selectedEdgeId) {
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      syncFlowElements(stages, transitions, nodePositions, null, null);
    }
  }, [selectedNodeId, selectedEdgeId, stages, transitions, nodePositions, syncFlowElements]);

  // Handle direct handle connection
  const onConnect = useCallback((params: Connection) => {
    if (!params.source || !params.target || params.source === params.target) return;

    const newTransition: WorkflowTransition = {
      id: `tr-${params.source}-${params.target}-${Date.now()}`,
      fromStageId: params.source,
      toStageId: params.target,
      name: '',
      rules: [],
    };

    const updatedTransitions = [...transitions, newTransition];
    setTransitions(updatedTransitions);
    setHasUnsavedChanges(true);

    setEdges((eds: Edge[]) =>
      addEdge(
        {
          ...params,
          id: newTransition.id,
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8', width: 14, height: 14 },
          style: { stroke: '#94a3b8', strokeWidth: 1.75 },
        },
        eds
      )
    );
    toast.success('Transition added between stages');
  }, [transitions, setEdges]);

  // Update a stage
  const handleUpdateStage = (updates: Partial<WorkflowStage>) => {
    if (!selectedNodeId) return;
    const updatedStages = stages.map((s) => (s.id === selectedNodeId ? { ...s, ...updates } : s));
    setStages(updatedStages);
    setHasUnsavedChanges(true);
    syncFlowElements(updatedStages, transitions, nodePositions, selectedNodeId, null);
    toast.success('Stage configuration updated');
  };

  // Delete a stage
  const handleDeleteStage = (stageId: string) => {
    const updatedStages = stages.filter((s) => s.id !== stageId).map((s, idx) => ({ ...s, order: idx + 1 }));
    const updatedTransitions = transitions.filter(
      (t) => t.fromStageId !== stageId && t.toStageId !== stageId
    );
    const updatedPositions = { ...nodePositions };
    delete updatedPositions[stageId];

    setStages(updatedStages);
    setTransitions(updatedTransitions);
    setNodePositions(updatedPositions);
    setSelectedNodeId(null);
    setHasUnsavedChanges(true);

    syncFlowElements(updatedStages, updatedTransitions, updatedPositions, null, null);
    toast.success('Stage and connected transitions deleted');
  };

  // Update a transition
  const handleUpdateTransition = (updates: Partial<WorkflowTransition>) => {
    if (!selectedEdgeId) return;
    const updatedTransitions = transitions.map((t) =>
      t.id === selectedEdgeId ? { ...t, ...updates } : t
    );
    setTransitions(updatedTransitions);
    setHasUnsavedChanges(true);
    syncFlowElements(stages, updatedTransitions, nodePositions, null, selectedEdgeId);
  };

  // Delete a transition
  const handleDeleteTransition = (transitionId: string) => {
    const updatedTransitions = transitions.filter((t) => t.id !== transitionId);
    setTransitions(updatedTransitions);
    setSelectedEdgeId(null);
    setHasUnsavedChanges(true);
    syncFlowElements(stages, updatedTransitions, nodePositions, null, null);
    toast.success('Transition removed');
  };

  // Add new stage
  const handleAddStage = (stageData: {
    name: string;
    type: WorkflowStageType;
    color: string;
    teamId?: string;
    teamLeaderId?: string;
    description?: string;
  }) => {
    const newStageId = `stage-${Date.now()}`;
    const newStage: WorkflowStage = {
      id: newStageId,
      workflowId: workflow?.id || `wf-${projectId}`,
      name: stageData.name,
      type: stageData.type,
      order: stages.length + 1,
      color: stageData.color,
      teamId: stageData.teamId,
      teamLeaderId: stageData.teamLeaderId,
      description: stageData.description,
      allowedNextStages: [],
    };

    // Calculate intelligent position for new node
    const highestY = Object.values(nodePositions).reduce((max, p) => Math.max(max, p.y), 400);
    const updatedPositions = {
      ...nodePositions,
      [newStageId]: { x: 300, y: highestY + 115 },
    };

    const updatedStages = [...stages, newStage];
    setStages(updatedStages);
    setNodePositions(updatedPositions);
    setSelectedNodeId(newStageId);
    setHasUnsavedChanges(true);

    syncFlowElements(updatedStages, transitions, updatedPositions, newStageId, null);
    toast.success(`Stage "${stageData.name}" added to canvas`);
  };

  // Add new transition
  const handleAddTransition = (transitionData: {
    fromStageId: string;
    toStageId: string;
    name: string;
  }) => {
    const newTransitionId = `tr-${transitionData.fromStageId}-${transitionData.toStageId}-${Date.now()}`;
    const newTransition: WorkflowTransition = {
      id: newTransitionId,
      fromStageId: transitionData.fromStageId,
      toStageId: transitionData.toStageId,
      name: '',
      rules: [],
    };

    const updatedTransitions = [...transitions, newTransition];
    setTransitions(updatedTransitions);
    setSelectedEdgeId(newTransitionId);
    setHasUnsavedChanges(true);

    syncFlowElements(stages, updatedTransitions, nodePositions, null, newTransitionId);
    toast.success('Transition added');
  };

  // Save / Update Workflow
  const handleSaveWorkflow = (newStatus?: 'ACTIVE' | 'INACTIVE' | 'DRAFT') => {
    if (!workflow) return;
    const finalStatus = newStatus || workflowStatus;

    updateWorkflow(workflow.id, {
      stages,
      transitions,
      nodePositions,
      status: finalStatus,
    });

    setWorkflowStatus(finalStatus);
    setHasUnsavedChanges(false);
    toast.success('Workflow successfully updated & saved');
  };

  // Discard changes
  const handleDiscardChanges = () => {
    if (workflow) {
      initFromWorkflow(workflow);
      toast.info('Changes discarded. Workflow restored to previous saved state.');
    }
  };

  // Create default workflow if none
  const handleCreateDefaultWorkflow = () => {
    const defaultWorkflowId = workflow?.id || `wf-${projectId}`;

    // Automatically resolve default teams for standard stages if present
    const devTeam = teams.find((t) => t.id === 'team-dev' || t.name.toLowerCase().includes('dev'));
    const qaTeam = teams.find((t) => t.id === 'team-qa' || t.name.toLowerCase().includes('qa') || t.name.toLowerCase().includes('test'));
    const productTeam = teams.find((t) => t.id === 'team-product' || t.name.toLowerCase().includes('product'));

    const defaultStages: WorkflowStage[] = [
      {
        id: `${projectId}-plan`,
        workflowId: defaultWorkflowId,
        name: 'Planning',
        type: 'PLANNING',
        order: 1,
        teamId: productTeam?.id,
        teamLeaderId: productTeam?.teamLeaderId,
        color: STAGE_TYPE_COLORS.PLANNING,
        allowedNextStages: [`${projectId}-dev`],
      },
      {
        id: `${projectId}-dev`,
        workflowId: defaultWorkflowId,
        name: 'Development',
        type: 'DEVELOPMENT',
        order: 2,
        teamId: devTeam?.id,
        teamLeaderId: devTeam?.teamLeaderId,
        color: STAGE_TYPE_COLORS.DEVELOPMENT,
        allowedNextStages: [`${projectId}-review`],
      },
      {
        id: `${projectId}-review`,
        workflowId: defaultWorkflowId,
        name: 'Code Review',
        type: 'CODE_REVIEW',
        order: 3,
        teamId: devTeam?.id,
        teamLeaderId: devTeam?.teamLeaderId,
        color: STAGE_TYPE_COLORS.CODE_REVIEW,
        allowedNextStages: [`${projectId}-testing`],
      },
      {
        id: `${projectId}-testing`,
        workflowId: defaultWorkflowId,
        name: 'Testing',
        type: 'TESTING',
        order: 4,
        teamId: qaTeam?.id,
        teamLeaderId: qaTeam?.teamLeaderId,
        color: STAGE_TYPE_COLORS.TESTING,
        allowedNextStages: [`${projectId}-bugfix`],
      },
      {
        id: `${projectId}-bugfix`,
        workflowId: defaultWorkflowId,
        name: 'Bug Fix',
        type: 'BUG_FIX',
        order: 5,
        teamId: devTeam?.id,
        teamLeaderId: devTeam?.teamLeaderId,
        color: STAGE_TYPE_COLORS.BUG_FIX,
        allowedNextStages: [`${projectId}-retest`],
      },
      {
        id: `${projectId}-retest`,
        workflowId: defaultWorkflowId,
        name: 'Re-test',
        type: 'RETEST',
        order: 6,
        teamId: qaTeam?.id,
        teamLeaderId: qaTeam?.teamLeaderId,
        color: STAGE_TYPE_COLORS.RETEST,
        allowedNextStages: [`${projectId}-testing`],
      },
    ];

    const defaultTransitions = getDefaultWorkflowTransitions(defaultStages);
    const defaultPositions = computeInitialPositions(defaultStages);

    if (workflow) {
      updateWorkflow(workflow.id, {
        stages: defaultStages,
        transitions: defaultTransitions,
        nodePositions: defaultPositions,
        status: 'ACTIVE',
      });
      initFromWorkflow({
        ...workflow,
        stages: defaultStages,
        transitions: defaultTransitions,
        nodePositions: defaultPositions,
        status: 'ACTIVE',
      });
    } else {
      const targetProject = projects.find((p) => p.id === projectId);
      const newWorkflow = createWorkflow({
        id: defaultWorkflowId,
        projectId,
        name: `${targetProject?.name || 'Project'} Standard Workflow`,
        stages: defaultStages,
        transitions: defaultTransitions,
        nodePositions: defaultPositions,
        status: 'ACTIVE',
      });

      const initialTeamIds = Array.from(
        new Set([
          ...(targetProject?.teamIds || []),
          devTeam?.id,
          qaTeam?.id,
          productTeam?.id,
        ].filter(Boolean))
      ) as string[];

      updateProject(projectId, {
        workflowId: newWorkflow.id,
        currentStageId: defaultStages[0].id,
        teamIds: initialTeamIds.length > 0 ? initialTeamIds : targetProject?.teamIds || [],
      });

      initFromWorkflow(newWorkflow);
    }
    toast.success('Standard Jira-style workflow created');
  };

  if (!workflow) {
    return (
      <div className="card p-8">
        <EmptyState
          title="No workflow configured"
          description="Create a standard visual workflow template to get started with your project pipeline."
          action={{
            label: 'Create Standard Workflow',
            onClick: handleCreateDefaultWorkflow,
          }}
        />
      </div>
    );
  }

  const selectedStage = stages.find((s) => s.id === selectedNodeId);
  const selectedTransition = transitions.find((t) => t.id === selectedEdgeId);

  const stageNameMap = new Map<string, string>([
    ['START', 'START'],
    ['DONE', 'Done'],
    ['ANY', 'Any Stage'],
    ...stages.map((s) => [s.id, s.name] as [string, string]),
  ]);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Workflow Header Toolbar */}
      <WorkflowToolbar
        workflowName={workflow.name}
        status={workflowStatus}
        hasUnsavedChanges={hasUnsavedChanges}
        onAddStage={() => setIsAddStageOpen(true)}
        onAddTransition={() => setIsAddTransitionOpen(true)}
        onUpdateWorkflow={handleSaveWorkflow}
        onDiscardChanges={handleDiscardChanges}
      />

      {/* Main Canvas & Configuration Layout */}
      <div className="relative flex flex-col lg:flex-row gap-4 h-[calc(100vh-210px)] min-h-[580px]">
        {/* Canvas Area */}
        <div className="flex-1 h-full bg-[#f8fafd] rounded-3xl border border-[#e0e2ec] shadow-2xs overflow-hidden relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            minZoom={0.2}
            maxZoom={1.75}
            defaultEdgeOptions={{
              type: 'smoothstep',
              markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8', width: 14, height: 14 },
            }}
            proOptions={{ hideAttribution: true }}
            className="flowexec-workflow-canvas"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={16}
              size={1.2}
              color="#cbd5e1"
            />
            <Controls
              className="!bg-white !border !border-[#e0e2ec] !rounded-2xl !shadow-sm !p-1"
              showInteractive={false}
            />
            <MiniMap
              nodeColor={(n: Node) => {
                if (n.type === 'startNode') return '#1e293b';
                if (n.type === 'doneNode') return '#059669';
                if (n.type === 'anyNode') return '#0891b2';
                return '#2563eb';
              }}
              nodeStrokeWidth={2}
              maskColor="rgba(240, 244, 249, 0.7)"
              className="!bg-white !border !border-[#e0e2ec] !rounded-2xl !shadow-sm !bottom-4 !right-4 !w-36 !h-24 hidden sm:block"
            />
          </ReactFlow>

          {/* Quick Help Overlay Badge */}
          <div className="absolute top-3 left-3 pointer-events-none hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 backdrop-blur-xs border border-[#e0e2ec] text-[11px] text-[#747775] shadow-2xs font-medium">
            <span>💡 Drag nodes to rearrange • Click node or transition to configure • Connect handles</span>
          </div>
        </div>

        {/* Right Configuration Sidebar */}
        <div
          className={`transition-all duration-300 ${
            selectedStage || selectedTransition
              ? 'w-full lg:w-80 xl:w-96 flex-shrink-0'
              : 'hidden'
          }`}
        >
          {selectedStage && (
            <StageConfigPanel
              stage={selectedStage}
              teams={teams}
              users={users}
              onUpdateStage={handleUpdateStage}
              onDeleteStage={handleDeleteStage}
              onClose={() => {
                setSelectedNodeId(null);
                syncFlowElements(stages, transitions, nodePositions, null, null);
              }}
            />
          )}

          {selectedTransition && (
            <TransitionConfigPanel
              transition={selectedTransition}
              fromName={stageNameMap.get(selectedTransition.fromStageId) || selectedTransition.fromStageId}
              toName={stageNameMap.get(selectedTransition.toStageId) || selectedTransition.toStageId}
              onUpdateTransition={handleUpdateTransition}
              onDeleteTransition={handleDeleteTransition}
              onClose={() => {
                setSelectedEdgeId(null);
                syncFlowElements(stages, transitions, nodePositions, null, null);
              }}
            />
          )}
        </div>
      </div>

      {/* Add Stage Modal */}
      <AddStageModal
        isOpen={isAddStageOpen}
        teams={teams}
        users={users}
        onClose={() => setIsAddStageOpen(false)}
        onAddStage={handleAddStage}
      />

      {/* Add Transition Modal */}
      <AddTransitionModal
        isOpen={isAddTransitionOpen}
        stages={stages}
        onClose={() => setIsAddTransitionOpen(false)}
        onAddTransition={handleAddTransition}
      />
    </div>
  );
};
