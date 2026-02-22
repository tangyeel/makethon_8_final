import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAnalysis } from '../hooks/useAnalysis.js'
import TradeRouteGlobe from '../components/globe/TradeRouteGlobe.jsx'
import { countries } from '../constants/countries.js'
import { upsertSavedAnalysis } from '../utils/savedAnalyses.js'
import { buildReportFilename, buildReportText, downloadReportText } from '../utils/reportExport.js'

const toRiskLevel = (score) => {
  if (score >= 70) return 'High'
  if (score >= 40) return 'Medium'
  return 'Low'
}

const toTitleCase = (value) =>
  String(value || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(Number(value || 0))

const countryNameByCode = (code) =>
  countries.find((country) => country.code === String(code || '').toUpperCase())?.name || code

const normalizeComplianceStatus = (status) => {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'pass' || normalized === 'warn' || normalized === 'action_required') {
    return normalized
  }
  return 'warn'
}

export default function Results() {
  const navigate = useNavigate()
  const {
    analysis,
    materials,
    tariffSummary,
    riskScore,
    tradeRoute,
    recentInsights,
    shippingOptions,
    complianceChecks,
    report,
    fetchReport
  } = useAnalysis()
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const confidence = useMemo(() => Math.round((analysis?.confidence || 0) * 100), [analysis])
  const riskLevel = useMemo(() => toRiskLevel(Number(riskScore || 0)), [riskScore])

  const routeData = useMemo(() => {
    if (Array.isArray(tradeRoute) && tradeRoute.length >= 2) {
      return tradeRoute
    }

    if (!analysis?.manufacturing_country || !analysis?.destination_country) {
      return null
    }

    return [
      {
        country: countryNameByCode(analysis.manufacturing_country),
        role: 'exporter',
        material: materials?.[0]?.name || analysis.product_name || 'Trade shipment',
        hs_code: analysis.hs_code || '0000.00'
      },
      {
        country: countryNameByCode(analysis.destination_country),
        role: 'importer',
        material: materials?.[0]?.name || analysis.product_name || 'Trade shipment',
        hs_code: analysis.hs_code || '0000.00'
      }
    ]
  }, [tradeRoute, analysis, materials])

  const sortedMaterials = useMemo(
    () => [...(materials || [])].sort((a, b) => Number(b.percentage || 0) - Number(a.percentage || 0)),
    [materials]
  )

  const topMaterials = sortedMaterials.slice(0, 3)

  const insightItems = useMemo(() => {
    if (Array.isArray(recentInsights) && recentInsights.length) {
      return recentInsights
    }

    return [
      {
        title: 'Duty impact signal',
        detail: `Estimated duty ${formatCurrency(tariffSummary?.estimated_duty_amount || 0)} on declared value ${formatCurrency(analysis?.declared_value || 0)}.`
      },
      {
        title: 'Risk outlook',
        detail: `Current risk is ${riskLevel.toLowerCase()} at ${Number(riskScore || 0).toFixed(2)} points.`
      },
      {
        title: 'Supply complexity',
        detail: `${sortedMaterials.length} material entries are contributing to the classification outcome.`
      }
    ]
  }, [recentInsights, tariffSummary, analysis, riskLevel, riskScore, sortedMaterials.length])

  const shippingItems = useMemo(() => {
    if (Array.isArray(shippingOptions) && shippingOptions.length) {
      return shippingOptions
    }

    const origin = countryNameByCode(analysis?.manufacturing_country)
    const destination = countryNameByCode(analysis?.destination_country)
    return [
      {
        mode: 'SEA',
        route: `${origin} -> ${destination}`,
        eta_days: 30,
        estimated_cost_usd: Math.max(1200, Number(analysis?.declared_value || 0) * 0.06),
        risk_level: 'Low',
        notes: 'Lower freight cost for large-volume shipment.'
      },
      {
        mode: 'AIR',
        route: `${origin} -> ${destination}`,
        eta_days: 8,
        estimated_cost_usd: Math.max(3200, Number(analysis?.declared_value || 0) * 0.18),
        risk_level: 'Medium',
        notes: 'Faster option for urgent or high-value cargo.'
      },
      {
        mode: 'INTERMODAL',
        route: `${origin} -> ${destination}`,
        eta_days: 18,
        estimated_cost_usd: Math.max(1800, Number(analysis?.declared_value || 0) * 0.1),
        risk_level: riskLevel,
        notes: 'Balanced transit time and freight spend.'
      }
    ]
  }, [shippingOptions, analysis, riskLevel])

  const complianceItems = useMemo(() => {
    if (Array.isArray(complianceChecks) && complianceChecks.length) {
      return complianceChecks
    }

    return [
      {
        item: 'HS code and tariff basis recorded',
        status: 'pass',
        note: `Classification recorded under HS ${analysis?.hs_code || 'N/A'}.`
      },
      {
        item: 'Material origin declarations',
        status: sortedMaterials.length ? 'pass' : 'warn',
        note: sortedMaterials.length
          ? 'Material origin list is present in this analysis response.'
          : 'No material lines were returned. Re-run analysis or edit materials.'
      },
      {
        item: 'Shipment documents pre-check',
        status: Number(tariffSummary?.total_duty_percent || 0) >= 15 ? 'warn' : 'pass',
        note: 'Verify invoice, packing list, and transport bill before booking.'
      }
    ]
  }, [complianceChecks, analysis, sortedMaterials.length, tariffSummary])

  const currentSnapshot = useMemo(
    () => ({
      analysis,
      materials: sortedMaterials,
      tariffSummary,
      riskScore: Number(riskScore || 0),
      tradeRoute: routeData || null,
      recentInsights: insightItems,
      shippingOptions: shippingItems,
      complianceChecks: complianceItems,
      report: report || null
    }),
    [
      analysis,
      sortedMaterials,
      tariffSummary,
      riskScore,
      routeData,
      insightItems,
      shippingItems,
      complianceItems,
      report
    ]
  )

  if (!analysis) {
    return (
      <div className="glass-panel p-8">
        <h2 className="section-title">No analysis results yet</h2>
        <p className="mt-3 text-sm text-[color:var(--text-muted)]">
          Upload a product image or enter product details, then run analysis to view results.
        </p>
        <div className="mt-6">
          <Link className="button-primary" to="/analysis">
            Start analysis
          </Link>
        </div>
      </div>
    )
  }

  const dutyPercent = Number(tariffSummary?.total_duty_percent || 0)
  const dutyAmount = Number(tariffSummary?.estimated_duty_amount || 0)
  const baseDuty = Number(tariffSummary?.base_duty || 0)
  const additionalDuty = Number(tariffSummary?.additional_duty || 0)
  const agreementDiscount = Number(tariffSummary?.trade_agreement_discount || 0)

  const handleSaveAnalysis = () => {
    if (!analysis?.analysis_id) {
      setActionError('Cannot save analysis without an analysis ID.')
      setActionMessage('')
      return
    }

    setIsSaving(true)
    setActionError('')
    setActionMessage('')

    try {
      upsertSavedAnalysis(currentSnapshot)
      setActionMessage('Analysis saved to your library.')
    } catch (error) {
      setActionError(error?.message || 'Failed to save analysis.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleExportReport = async () => {
    if (!analysis?.analysis_id) {
      setActionError('Cannot export report without an analysis ID.')
      setActionMessage('')
      return
    }

    setIsExporting(true)
    setActionError('')
    setActionMessage('')

    try {
      let reportPayload = report || null
      let usedFallback = false

      if (!reportPayload) {
        try {
          reportPayload = await fetchReport(analysis.analysis_id)
        } catch {
          usedFallback = true
        }
      }

      const reportText = buildReportText({
        ...currentSnapshot,
        report: reportPayload || currentSnapshot.report
      })
      const filename = buildReportFilename(analysis.analysis_id)
      downloadReportText(filename, reportText)

      setActionMessage(
        usedFallback
          ? 'Report exported using current analysis data (backend summary unavailable).'
          : 'Report exported.'
      )
    } catch (error) {
      setActionError(error?.message || 'Failed to export report.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-12">
      <section className="dashboard-hero">
        <div className="dashboard-frame">
          <div className="dashboard-map">
            <TradeRouteGlobe routeData={routeData} />
          </div>
          <div className="dashboard-cta-row">
            <button className="dashboard-chip" type="button" onClick={() => navigate('/analysis')}>
              Change country
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-4">
        <div className="stat-card">
          <p className="label">HS Code</p>
          <h3>{analysis.hs_code || 'N/A'}</h3>
          <span>{confidence}% confidence</span>
        </div>
        <div className="stat-card">
          <p className="label">Estimated Duty</p>
          <h3>{dutyPercent.toFixed(2)}%</h3>
          <span>{formatCurrency(dutyAmount)}</span>
        </div>
        <div className="stat-card">
          <p className="label">Risk Score</p>
          <h3>{Number(riskScore || 0).toFixed(2)}</h3>
          <span>{riskLevel} risk</span>
        </div>
        <div className="stat-card">
          <p className="label">Declared Value</p>
          <h3>{formatCurrency(analysis.declared_value)}</h3>
          <span>
            {countryNameByCode(analysis.manufacturing_country)} to {countryNameByCode(analysis.destination_country)}
          </span>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="glass-panel p-6">
          <h3 className="section-title">Tariff Exposure</h3>
          <div className="stacked-bars mt-6">
            <div className="stacked-row">
              <span>Base Duty</span>
              <div className="stacked-track">
                <div className="stacked-fill" style={{ width: `${Math.min(baseDuty * 2.5, 100)}%` }} />
              </div>
            </div>
            <div className="stacked-row">
              <span>Additional Duty</span>
              <div className="stacked-track">
                <div className="stacked-fill warm" style={{ width: `${Math.min(additionalDuty * 2.5, 100)}%` }} />
              </div>
            </div>
            <div className="stacked-row">
              <span>Agreement Effect</span>
              <div className="stacked-track">
                <div className="stacked-fill alt" style={{ width: `${Math.min(Math.abs(agreementDiscount) * 2.5, 100)}%` }} />
              </div>
            </div>
            <div className="stacked-row">
              <span>Total Duty</span>
              <div className="stacked-track">
                <div className="stacked-fill muted" style={{ width: `${Math.min(dutyPercent * 2.5, 100)}%` }} />
              </div>
            </div>
          </div>
          <p className="mt-4 text-sm text-[color:var(--text-muted)]">
            {tariffSummary?.explanation || 'Tariff explanation is not available.'}
          </p>
        </div>
        <div className="glass-panel p-6">
          <h3 className="section-title">Classification Notes</h3>
          <div className="list-stack mt-6">
            <div>
              <p className="list-title">AI Explanation</p>
              <p className="list-sub">{analysis.explanation || 'Not provided by backend.'}</p>
            </div>
            <div>
              <p className="list-title">Resolved Description</p>
              <p className="list-sub">{analysis.resolved_description || 'Generated from uploaded image if no text description was provided.'}</p>
            </div>
            <div>
              <p className="list-title">Analysis ID</p>
              <p className="list-sub">{analysis.analysis_id}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="glass-panel p-6">
          <h3 className="section-title">Top Origin Mix</h3>
          <div className="donut-grid">
            <div className="donut-ring" />
            <div className="space-y-3">
              {topMaterials.length === 0 && <p className="text-sm text-[color:var(--text-muted)]">No materials returned.</p>}
              {topMaterials.map((material, index) => (
                <div className="legend-row" key={material.id || `${material.name}-${index}`}>
                  <span className={`legend-dot${index === 1 ? ' alt' : index === 2 ? ' warm' : ''}`} />
                  <p>
                    {countryNameByCode(material.origin_country)} - {Number(material.percentage || 0).toFixed(2)}% ({toTitleCase(material.name)})
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="glass-panel p-6">
          <h3 className="section-title">Material Breakdown Bars</h3>
          <div className="stacked-bars mt-6">
            {sortedMaterials.length === 0 && (
              <p className="text-sm text-[color:var(--text-muted)]">No materials found in this analysis.</p>
            )}
            {sortedMaterials.map((material, index) => {
              const pct = Number(material.percentage || 0)
              const colorClass = index % 3 === 1 ? ' alt' : index % 3 === 2 ? ' warm' : ''
              return (
                <div className="stacked-row" key={material.id || `${material.name}-${index}`}>
                  <span>{toTitleCase(material.name)}</span>
                  <div className="stacked-track">
                    <div className={`stacked-fill${colorClass}`} style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="glass-panel p-6">
          <h3 className="section-title">Recent Insights</h3>
          <p className="mt-2 text-xs text-[color:var(--text-muted)]">AI-generated trade news signals for this product lane.</p>
          <div className="insight-grid md:grid-cols-1">
            {insightItems.map((item, idx) => (
              <div className="insight-card" key={`${item.title}-${idx}`}>
                <h4>{item.title}</h4>
                <p>{item.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel p-6">
          <h3 className="section-title">Routing Options</h3>
          <div className="route-grid mt-6">
            {shippingItems.map((option, idx) => (
              <div className="route-card" key={`${option.mode}-${idx}`}>
                <h4>{String(option.mode || 'MODE').toUpperCase()} - {option.route || `${countryNameByCode(analysis.manufacturing_country)} -> ${countryNameByCode(analysis.destination_country)}`}</h4>
                <p>{Number(option.eta_days || 0)} days est. - {String(option.risk_level || 'Medium')} risk</p>
                <span>{formatCurrency(option.estimated_cost_usd || 0)}</span>
                {option.notes && <p className="list-sub mt-2">{option.notes}</p>}
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel p-6">
          <h3 className="section-title">Compliance Checks</h3>
          <div className="checklist mt-6">
            {complianceItems.map((check, idx) => {
              const status = normalizeComplianceStatus(check.status)
              const isWarn = status === 'warn' || status === 'action_required'
              return (
                <div className={`check-row ${isWarn ? 'warn' : ''}`} key={`${check.item}-${idx}`}>
                  <span className="check-dot" />
                  <div>
                    <p>{check.item}</p>
                    {check.note && <p className="list-sub">{check.note}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="dashboard-actions print-hidden">
        <button className="button-secondary" type="button" onClick={() => navigate('/analysis')}>
          Go back
        </button>
        <div className="action-group">
          <button className="button-secondary" type="button" onClick={() => navigate('/home')}>
            Main menu
          </button>
          <button
            className="button-secondary"
            type="button"
            onClick={handleExportReport}
            disabled={isExporting}
          >
            {isExporting ? 'Exporting...' : 'Export report'}
          </button>
          <button
            className="button-primary"
            type="button"
            onClick={handleSaveAnalysis}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save analysis'}
          </button>
        </div>
        {actionMessage && <p className="text-xs text-[color:var(--text-muted)]">{actionMessage}</p>}
        {actionError && <p className="text-xs text-ember">{actionError}</p>}
      </section>
    </div>
  )
}
