// Beacon components are plain DOM factories: each returns an HTMLElement you append where you like. No framework.
export interface ButtonProps { label: string; variant?: 'primary' | 'quiet' | 'danger'; disabled?: boolean; onClick?: (e: MouseEvent) => void }
export declare function Button(props: ButtonProps): HTMLButtonElement;
export interface SeverityChipProps { severity: 'critical' | 'warning' | 'info' | 'ok'; label?: string }
export declare function SeverityChip(props: SeverityChipProps): HTMLSpanElement;
export interface StatusChipProps { status: 'open' | 'investigating' | 'awaiting-approval' | 'resolved' | 'verified' | 'escalated' | 'unverified'; label?: string }
export declare function StatusChip(props: StatusChipProps): HTMLSpanElement;
export interface StatRowProps { items: Array<string | { value: string; label?: string }> }
export declare function StatRow(props: StatRowProps): HTMLDivElement;
export interface EvidenceRow { kind: string; claim: string; pointer: string; href?: string }
export interface EvidenceTableProps { rows: EvidenceRow[] }
export declare function EvidenceTable(props: EvidenceTableProps): HTMLTableElement;
export interface CausalStep { time: string; text: string; severity?: 'critical' | 'warning' | 'info' }
export interface CausalChainProps { steps: CausalStep[] }
export declare function CausalChain(props: CausalChainProps): HTMLDivElement;
export interface ApprovalCardProps { finding: string; action: string; blastRadius: string; canApprove?: boolean; approveLabel?: string; onApprove?: () => void; onDeny?: () => void }
export declare function ApprovalCard(props: ApprovalCardProps): HTMLDivElement;
export interface CapabilityItem { name: string; detail?: string; state: 'available' | 'missing' | 'none' }
export interface CapabilityListProps { items: CapabilityItem[] }
export declare function CapabilityList(props: CapabilityListProps): HTMLUListElement;
declare global { interface Window { Beacon: { Button: typeof Button; SeverityChip: typeof SeverityChip; StatusChip: typeof StatusChip; StatRow: typeof StatRow; EvidenceTable: typeof EvidenceTable; CausalChain: typeof CausalChain; ApprovalCard: typeof ApprovalCard; CapabilityList: typeof CapabilityList } } }
