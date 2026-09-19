import { STATUS_META } from '../lib/constants'
export default function StatusBadge({status}){const [label,tone]=STATUS_META[status]||[status,'gray'];return <span className={`badge ${tone}`}>{label}</span>}
