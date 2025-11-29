import { useMemo, useState } from 'react'

type PerformanceBand = 'elite' | 'strong' | 'stable' | 'risk'
type ExperienceBand = 'principal' | 'senior' | 'mid' | 'junior'
type DecisionAction = 'increase' | 'decrease' | 'keep' | 'fire'

type Employee = {
  id: string
  name: string
  role: string
  functionArea: string
  positionLevel: string
  tenureYears: number
  salary: number
  variableExpense: number
  revenueInfluence: number
  performance: PerformanceBand
  experience: ExperienceBand
  locationCost: 'high' | 'standard' | 'low'
  automationReadiness: number
}

const performanceWeights: Record<PerformanceBand, number> = {
  elite: 1,
  strong: 0.82,
  stable: 0.62,
  risk: 0.32,
}

const experienceWeights: Record<ExperienceBand, number> = {
  principal: 1,
  senior: 0.85,
  mid: 0.65,
  junior: 0.45,
}

const locationCostPenalty = {
  low: 0.02,
  standard: 0.08,
  high: 0.14,
}

const mockEmployees: Employee[] = [
  {
    id: 'EMP-101',
    name: 'Ava Shah',
    role: 'Enterprise Account Executive',
    functionArea: 'Revenue',
    positionLevel: 'IC6',
    tenureYears: 4.5,
    salary: 14940000,
    variableExpense: 2656000,
    revenueInfluence: 51460000,
    performance: 'elite',
    experience: 'principal',
    locationCost: 'high',
    automationReadiness: 0.76,
  },
  {
    id: 'EMP-145',
    name: 'Mateo Rivas',
    role: 'Customer Success Manager',
    functionArea: 'Revenue',
    positionLevel: 'IC4',
    tenureYears: 2.1,
    salary: 8715000,
    variableExpense: 2324000,
    revenueInfluence: 15770000,
    performance: 'stable',
    experience: 'mid',
    locationCost: 'standard',
    automationReadiness: 0.58,
  },
  {
    id: 'EMP-167',
    name: 'Harper Lin',
    role: 'Senior ML Engineer',
    functionArea: 'Product',
    positionLevel: 'IC5',
    tenureYears: 3.8,
    salary: 17430000,
    variableExpense: 3735000,
    revenueInfluence: 42330000,
    performance: 'strong',
    experience: 'senior',
    locationCost: 'high',
    automationReadiness: 0.71,
  },
  {
    id: 'EMP-204',
    name: 'Noah Patel',
    role: 'Financial Analyst',
    functionArea: 'G&A',
    positionLevel: 'IC3',
    tenureYears: 1.6,
    salary: 7636000,
    variableExpense: 996000,
    revenueInfluence: 7885000,
    performance: 'risk',
    experience: 'mid',
    locationCost: 'standard',
    automationReadiness: 0.41,
  },
  {
    id: 'EMP-230',
    name: 'Imani Brooks',
    role: 'People Ops Lead',
    functionArea: 'G&A',
    positionLevel: 'Mgr2',
    tenureYears: 6.2,
    salary: 11454000,
    variableExpense: 2988000,
    revenueInfluence: 14110000,
    performance: 'strong',
    experience: 'senior',
    locationCost: 'low',
    automationReadiness: 0.65,
  },
]

const formatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max)

const deriveDecision = (employee: Employee, overrideSalary?: number) => {
  const salary = overrideSalary ?? employee.salary
  const totalCost = salary + employee.variableExpense
  const profit = employee.revenueInfluence - totalCost
  const margin = employee.revenueInfluence === 0 ? 0 : profit / employee.revenueInfluence

  const normalizedProfit = clamp(0.5 + profit / 33200000, 0, 1)
  const marginScore = clamp(0.5 + margin / 0.5, 0, 1)
  const perfScore = performanceWeights[employee.performance]
  const xpScore = experienceWeights[employee.experience]
  const locationPenalty = locationCostPenalty[employee.locationCost]

  const composite =
    0.32 * perfScore +
    0.24 * xpScore +
    0.26 * normalizedProfit +
    0.18 * (marginScore - locationPenalty)

  let action: DecisionAction = 'keep'
  if (profit < -2905000 || (composite < 0.35 && margin < 0)) {
    action = 'fire'
  } else if (composite < 0.55 || margin < 0.1) {
    action = 'decrease'
  } else if (composite > 0.78 && profit > 1660000) {
    action = 'increase'
  }

  const reasonMap: Record<DecisionAction, string> = {
    increase: 'High profit capture and top-tier performance warrant an upside adjustment.',
    decrease: 'Profit conversion is lagging—optimize compensation or rebalance workload.',
    keep: 'Healthy profitability and aligned contribution—hold steady this cycle.',
    fire: 'Sustained negative profit plus low scores signal a necessary exit discussion.',
  }

  return {
    action,
    reason: reasonMap[action],
    confidence: clamp(composite),
    automation: clamp(0.4 + employee.automationReadiness * 0.6),
    profitability: profit,
    margin,
  }
}

const factorLibrary = [
  { label: 'Location cost multiplier', detail: 'Geo-based labor premium pulled from finance COE' },
  { label: 'Automation readiness', detail: 'Can downstream workflow auto-trigger Workday comp events' },
  { label: 'Attrition probability', detail: 'Signal from talent intelligence + performance trajectory' },
  { label: 'Role criticality', detail: 'Dependency graph of in-flight projects and coverage depth' },
]

const decisionPalette: Record<DecisionAction, string> = {
  increase: '#2563eb',
  decrease: '#d97706',
  keep: '#15803d',
  fire: '#dc2626',
}

const DecisionBadge = ({ action }: { action: DecisionAction }) => (
  <span className="decision-badge" style={{ background: decisionPalette[action] }}>
    {action === 'fire'
      ? 'Fire'
      : action === 'increase'
        ? 'Increase Salary'
        : action === 'decrease'
          ? 'Decrease Salary'
          : 'Do Nothing'}
  </span>
)

function App() {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(mockEmployees[0].id)
  const selectedEmployee = mockEmployees.find((emp) => emp.id === selectedEmployeeId) ?? mockEmployees[0]
  const [scenarioSalary, setScenarioSalary] = useState(selectedEmployee.salary)

  const selectedDecision = useMemo(
    () => deriveDecision(selectedEmployee),
    [selectedEmployee],
  )

  const scenarioDecision = useMemo(() => deriveDecision(selectedEmployee, scenarioSalary), [selectedEmployee, scenarioSalary])

  const orgSummary = useMemo(() => {
    const totals = mockEmployees.reduce(
      (acc, emp) => {
        const totalCost = emp.salary + emp.variableExpense
        const profit = emp.revenueInfluence - totalCost
        if (profit < 0) acc.atRisk += 1
        acc.totalSalary += emp.salary
        acc.totalExpense += totalCost
        acc.totalRevenue += emp.revenueInfluence
        acc.netProfit += profit
        return acc
      },
      {
        atRisk: 0,
        totalSalary: 0,
        totalExpense: 0,
        totalRevenue: 0,
        netProfit: 0,
      },
    )
    return {
      ...totals,
      margin: totals.totalRevenue === 0 ? 0 : totals.netProfit / totals.totalRevenue,
    }
  }, [])

  const updateSelected = (employee: Employee) => {
    setSelectedEmployeeId(employee.id)
    setScenarioSalary(employee.salary)
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Agentic Finance Copilot</p>
          <h1>Sense profitability per employee and automate compensation moves.</h1>
          <p className="lede">
            Stream live expense, revenue, and talent signals into a reasoning agent that outputs clear actions—fire, salary decrease,
            increase, or hold—for every employee. Corporate Ops can approve with one click, and downstream HRIS automations do the rest.
          </p>
        </div>
        <div className="hero-actions">
          <button className="primary">Deploy Agent Workflow</button>
          <button className="ghost">Download Decision Log</button>
        </div>
      </header>

      <section className="summary-grid">
        <article className="summary-card">
          <p>Total net profit</p>
          <h2>{formatter.format(orgSummary.netProfit)}</h2>
          <span className="trend positive">↑ 12.4% QoQ</span>
        </article>
        <article className="summary-card">
          <p>Compensation burn</p>
          <h2>{formatter.format(orgSummary.totalExpense)}</h2>
          <span className="trend neutral">Includes salary + variable</span>
        </article>
        <article className="summary-card">
          <p>Margin</p>
          <h2>{(orgSummary.margin * 100).toFixed(1)}%</h2>
          <span className="trend positive">Goal ≥ 28%</span>
        </article>
        <article className="summary-card">
          <p>Employees flagged</p>
          <h2>{orgSummary.atRisk} / {mockEmployees.length}</h2>
          <span className="trend warning">Require manual review</span>
        </article>
      </section>

      <section className="panels">
        <div className="panel primary-panel">
          <header className="panel-header">
            <div>
              <h3>Employee profitability radar</h3>
              <p>Select a profile to inspect the AI recommendation.</p>
            </div>
            <div className="legend">
              {(['increase', 'keep', 'decrease', 'fire'] as DecisionAction[]).map((action) => (
                <span key={action}>
                  <span className="legend-dot" style={{ background: decisionPalette[action] }} />
                  {action}
                </span>
              ))}
            </div>
          </header>

          <div className="employee-table">
            <div className="employee-row header">
              <span>Employee</span>
              <span>Role</span>
              <span>Profit</span>
              <span>Performance</span>
              <span>Decision</span>
            </div>

            {mockEmployees.map((employee) => {
              const decision = deriveDecision(employee)
              return (
                <button
                  key={employee.id}
                  className={`employee-row ${employee.id === selectedEmployeeId ? 'selected' : ''}`}
                  onClick={() => updateSelected(employee)}
                >
                  <span>
                    <strong>{employee.name}</strong>
                    <small>{employee.id}</small>
                  </span>
                  <span>
                    {employee.role}
                    <small>{employee.positionLevel} • {employee.functionArea}</small>
                  </span>
                  <span>
                    {formatter.format(decision.profitability)}
                    <small>Margin {(decision.margin * 100).toFixed(1)}%</small>
                  </span>
                  <span className={`performance ${employee.performance}`}>{employee.performance}</span>
                  <span>
                    <DecisionBadge action={decision.action} />
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <aside className="panel detail-panel">
          <section className="detail-card">
            <div className="detail-header">
              <div>
                <p className="eyebrow">{selectedEmployee.functionArea} • {selectedEmployee.positionLevel}</p>
                <h3>{selectedEmployee.name}</h3>
                <p>{selectedEmployee.role}</p>
              </div>
              <DecisionBadge action={selectedDecision.action} />
            </div>

            <div className="detail-grid">
              <article>
                <p>Profit capture</p>
                <h4>{formatter.format(selectedDecision.profitability)}</h4>
                <small>Margin {(selectedDecision.margin * 100).toFixed(1)}%</small>
              </article>
              <article>
                <p>Confidence</p>
                <h4>{(selectedDecision.confidence * 100).toFixed(0)}%</h4>
                <small>AI certainty score</small>
              </article>
              <article>
                <p>Automation ready</p>
                <h4>{(selectedDecision.automation * 100).toFixed(0)}%</h4>
                <small>HRIS sync coverage</small>
              </article>
            </div>

            <p className="reasoning">{selectedDecision.reason}</p>
          </section>

          <section className="detail-card">
            <h4>Scenario: adjust salary</h4>
            <div className="scenario-input">
              <input
                type="range"
                min={selectedEmployee.salary * 0.6}
                max={selectedEmployee.salary * 1.4}
                value={scenarioSalary}
                onChange={(event) => setScenarioSalary(Number(event.target.value))}
              />
              <div className="scenario-values">
                <span>{formatter.format(selectedEmployee.salary * 0.6)}</span>
                <strong>{formatter.format(scenarioSalary)}</strong>
                <span>{formatter.format(selectedEmployee.salary * 1.4)}</span>
              </div>
            </div>
            <div className="scenario-outcome">
              <DecisionBadge action={scenarioDecision.action} />
              <div>
                <p>Projected profit</p>
                <strong>{formatter.format(scenarioDecision.profitability)}</strong>
                <small>Margin {(scenarioDecision.margin * 100).toFixed(1)}%</small>
              </div>
              <div>
                <p>Agent confidence</p>
                <strong>{(scenarioDecision.confidence * 100).toFixed(0)}%</strong>
                <small>updates live</small>
              </div>
            </div>
          </section>

          <section className="detail-card">
            <h4>Automation playbook</h4>
            <ol className="automation-steps">
              <li>
                <strong>1. Stream & normalize</strong>
                <p>Collect finance, HRIS, and CRM signals into the feature lake.</p>
              </li>
              <li>
                <strong>2. Reason & decide</strong>
                <p>Agentic chain maps profit, role criticality, and people risk to actions.</p>
              </li>
              <li>
                <strong>3. Approve & trigger</strong>
                <p>Exec signs digitally; downstream Workday / ServiceNow flows auto-fire.</p>
              </li>
            </ol>
          </section>

          <section className="detail-card">
            <h4>Additional factors tracked</h4>
            <div className="chip-grid">
              {factorLibrary.map((factor) => (
                <article key={factor.label} className="chip">
                  <strong>{factor.label}</strong>
                  <p>{factor.detail}</p>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </div>
  )
}

export default App

