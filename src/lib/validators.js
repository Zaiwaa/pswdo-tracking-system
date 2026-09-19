import { DROMIC_FIELDS } from '../data/dromicFields'
const n=v=>v===''||v==null?0:Number(v)
export function validateBarangay(data, previous={}){
  const issues=[]
  for(const field of DROMIC_FIELDS){
    const raw=data[field.key]
    if(field.required && (raw===''||raw==null)) issues.push({severity:'RED',field:field.key,message:`${field.label} is required.`})
    if(['number','money'].includes(field.kind) && raw!=='' && raw!=null && (!Number.isFinite(Number(raw)) || Number(raw)<0)) issues.push({severity:'RED',field:field.key,message:`${field.label} must be a non-negative number.`})
    if(field.behavior==='CUM'){
      const now=n(data[field.pair]); const cum=n(raw); const prev=n(previous[field.key])
      if(now>cum) issues.push({severity:'RED',field:field.key,message:`NOW (${now}) cannot be greater than CUM (${cum}).`})
      if(cum<prev) issues.push({severity:'RED',field:field.key,message:`CUM cannot decrease below previous CUM (${prev}).`})
      if(prev>0 && cum===0) issues.push({severity:'RED',field:field.key,message:`CUM cannot reset to zero; previous CUM is ${prev}.`})
    }
  }
  const af=n(data.affected_families), ap=n(data.affected_persons)
  if(af>ap && ap>0) issues.push({severity:'ORANGE',field:'affected_families',message:'Affected families are greater than affected persons. Verify the figures.'})
  const insideF=n(data.inside_families_now), insideP=n(data.inside_persons_now)
  if(insideF>insideP && insideP>0) issues.push({severity:'ORANGE',field:'inside_families_now',message:'Inside-EC families are greater than persons.'})
  const outsideF=n(data.outside_families_now), outsideP=n(data.outside_persons_now)
  if(outsideF>outsideP && outsideP>0) issues.push({severity:'ORANGE',field:'outside_families_now',message:'Outside-EC families are greater than persons.'})
  return issues
}
export function computedTotals(data){
  const x=k=>n(data[k])
  return {
    total_displaced_families_cum:x('inside_families_cum')+x('outside_families_cum'),
    total_displaced_families_now:x('inside_families_now')+x('outside_families_now'),
    total_displaced_persons_cum:x('inside_persons_cum')+x('outside_persons_cum'),
    total_displaced_persons_now:x('inside_persons_now')+x('outside_persons_now'),
    damaged_houses_total:x('damaged_totally')+x('damaged_partially')
  }
}
