import { useState, useCallback } from 'react'
import StatusBadge from './StatusBadge'
import { formatCnpj } from '../utils/cnpj'

interface OwnershipNodeProps {
  node: any
  depth?: number
  isRoot?: boolean
  onNavigate: (cnpj: string) => void
}

function OwnershipNode({ node, depth = 0, isRoot = false, onNavigate }: OwnershipNodeProps) {
  const [expanded, setExpanded] = useState(depth < 3)

  const hasChildren = node.children && node.children.length > 0
  const isPJ = node.tipo === 'PJ' || node.type === 'PJ'
  const isCycle = node.is_cycle || node.cycle_detected
  const isUnresolved = node.is_unresolved || node.unresolved

  const nodeTypeClass = isCycle
    ? 'ownership-node--cycle'
    : isUnresolved
      ? 'ownership-node--unresolved'
      : isPJ
        ? 'ownership-node--pj'
        : 'ownership-node--pf'

  const rootClass = isRoot ? 'ownership-node--root' : ''

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev)
  }, [])

  const handleNavigate = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      const cnpj = (node.cnpj || node.cnpj_cpf || '').replace(/\D/g, '')
      if (cnpj && cnpj.length === 14) {
        onNavigate(cnpj)
      }
    },
    [node, onNavigate],
  )

  const cnpjDisplay = node.cnpj || node.cnpj_cpf || ''
  const cleanedCnpj = cnpjDisplay.replace(/\D/g, '')

  return (
    <div className={`ownership-node ${nodeTypeClass} ${rootClass}`}>
      <div className="ownership-node__header" onClick={hasChildren ? handleToggle : undefined}>
        {hasChildren && (
          <button
            className={`ownership-node__toggle ${expanded ? 'ownership-node__toggle--expanded' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              handleToggle()
            }}
            aria-label={expanded ? 'Recolher' : 'Expandir'}
            aria-expanded={expanded}
          >
            ▶
          </button>
        )}

        {!hasChildren && <span style={{ width: '1.25rem', flexShrink: 0 }} />}

        <span className="ownership-node__name">{node.nome || node.name || node.razao_social || '—'}</span>

        {isPJ && cleanedCnpj.length === 14 && (
          <span className="ownership-node__cnpj" onClick={handleNavigate} style={{ cursor: 'pointer' }} title="Consultar este CNPJ">
            {formatCnpj(cleanedCnpj)}
          </span>
        )}

        {node.qualificacao && <span className="ownership-node__qual">{node.qualificacao}</span>}

        {isPJ && <StatusBadge variant="gold">PJ</StatusBadge>}

        {!isPJ && !isCycle && !isUnresolved && <StatusBadge variant="silver">PF</StatusBadge>}

        {isCycle && <span className="ownership-node__cycle-badge">⟲ Ciclo detectado</span>}

        {isUnresolved && <span className="ownership-node__unresolved-badge">⚠ Não resolvido</span>}

        {depth > 0 && <span className="ownership-node__depth">Nível {depth}</span>}
      </div>

      {hasChildren && expanded && (
        <div className="ownership-node__children">
          {node.children.map((child: any, index: number) => (
            <OwnershipNode
              key={`${child.cnpj || child.cnpj_cpf || child.nome || index}-${index}`}
              node={child}
              depth={depth + 1}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function OwnershipTree({ tree, onNavigate }: { tree: any; onNavigate: (cnpj: string) => void }) {
  if (!tree) return null

  const rootNode = tree.root || tree
  const metadata = tree.metadata || {}

  return (
    <div className="ownership-tree-container">
      <OwnershipNode node={rootNode} depth={0} isRoot onNavigate={onNavigate} />

      {(metadata.total_nodes || metadata.max_depth || metadata.unresolved_count) && (
        <div className="query-metadata" style={{ marginTop: 'var(--space-md)' }}>
          {metadata.total_nodes != null && (
            <div className="query-metadata__item">
              <span className="query-metadata__label">Total de nós:</span>
              <span className="query-metadata__value">{metadata.total_nodes}</span>
            </div>
          )}
          {metadata.max_depth != null && (
            <div className="query-metadata__item">
              <span className="query-metadata__label">Profundidade máx.:</span>
              <span className="query-metadata__value">{metadata.max_depth}</span>
            </div>
          )}
          {metadata.unresolved_count != null && metadata.unresolved_count > 0 && (
            <div className="query-metadata__item">
              <span className="query-metadata__label">Não resolvidos:</span>
              <StatusBadge variant="warning">{metadata.unresolved_count}</StatusBadge>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
