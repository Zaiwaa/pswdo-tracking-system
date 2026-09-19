const pair=(key,label,group,opts={})=>[
  {key:`${key}_cum`,label:`${label} — CUM`,group,kind:'number',behavior:'CUM',pair:`${key}_now`,...opts},
  {key:`${key}_now`,label:`${label} — NOW`,group,kind:'number',behavior:'NOW',pair:`${key}_cum`,...opts}
]
const demographic=[]
for(const [key,label] of [['infant','Infant 0–6 mos'],['toddler','Toddlers 7 mos–2 y/o'],['preschool','Preschoolers 3–5 y/o'],['school_age','School Age 6–12 y/o'],['teenage','Teenage 13–17 y/o'],['adult','Adult 18–59 y/o'],['elderly','Elderly 60 and above']]){
  demographic.push(...pair(`${key}_male`,`${label} / Male`,'Sex & Age Distribution'))
  demographic.push(...pair(`${key}_female`,`${label} / Female`,'Sex & Age Distribution'))
}
const vulnerable=[]
for(const [key,label] of [['pregnant','Pregnant'],['lactating','Lactating Mothers']]) vulnerable.push(...pair(key,label,'Vulnerable Sectors'))
for(const [key,label] of [['child_headed','Child-Headed Family'],['single_headed','Single-Headed Family'],['solo_parent','Solo Parent'],['pwd','Persons with Disability'],['ip','Indigenous People (IPs)'],['4ps_beneficiaries','4Ps Beneficiaries']]){
  vulnerable.push(...pair(`${key}_male`,`${label} / Male`,'Vulnerable Sectors'))
  vulnerable.push(...pair(`${key}_female`,`${label} / Female`,'Vulnerable Sectors'))
}
const facilities=[]
for(const [key,label] of [['child_friendly_space','Child-Friendly Spaces'],['women_friendly_space','Women Friendly Spaces'],['health_facility','Health Facility'],['prayer_room','Prayer Rooms'],['community_kitchen','Community Kitchens'],['handwashing','Handwashing Facility'],['livestock_area','Livestock Area'],['camp_management_desk','Camp Management Desk'],['info_board','Info Boards'],['storage_area','Storage Area'],['laundry_space','Laundry Space']]) facilities.push(...pair(key,label,'Evacuation Center Facilities'))
const tents=[]
for(const [key,label] of [['family_tent','Family Tents'],['modular_tent','Modular Tents'],['child_friendly_tent','Child Friendly Tents'],['women_friendly_tent','Women Friendly Tents']]) tents.push(...pair(key,label,'Tents Deployed'))
const assistance=[]
for(const [key,label] of [['ffp','FFP'],['heb','HEB'],['rtef','RTEF'],['rice','RICE'],['other_food','Other Food Items'],['family_kits','Family Kits'],['family_tent_item','Family Tent'],['hygiene_kits','Hygiene Kits'],['kitchen_kits','Kitchen Kits'],['laminated_sacks','Laminated Sacks'],['modular_tent_item','Modular Tent'],['shelter_kits','Shelter Kits'],['sleeping_kits','Sleeping Kits'],['water_container','Water Container'],['other_nfi','Other Non-Food Items']]){
  assistance.push({key:`${key}_qty`,label:`${label} — Quantity`,group:'Cost of Assistance',kind:'number'})
  assistance.push({key:`${key}_unit_cost`,label:`${label} — Unit Cost`,group:'Cost of Assistance',kind:'money'})
  assistance.push({key:`${key}_cost`,label:`${label} — Cost`,group:'Cost of Assistance',kind:'money',computedFrom:[`${key}_qty`,`${key}_unit_cost`]})
}
for(const [key,label] of [['aics','AICS'],['akap','AKAP']]){
  assistance.push({key:`${key}_beneficiaries`,label:`${label} — Number of Beneficiaries`,group:'Financial Assistance',kind:'number'})
  assistance.push({key:`${key}_unit_cost`,label:`${label} — Unit Cost`,group:'Financial Assistance',kind:'money'})
  assistance.push({key:`${key}_cost`,label:`${label} — Cost`,group:'Financial Assistance',kind:'money',computedFrom:[`${key}_beneficiaries`,`${key}_unit_cost`]})
}
for(const [key,label] of [['ect','ECT'],['cfw','CFW'],['slp','SLP']]){
  assistance.push({key:`${key}_beneficiaries`,label:`${label} — Number of Beneficiaries`,group:'Financial Assistance',kind:'number'})
  assistance.push({key:`${key}_cost`,label:`${label} — Cost`,group:'Financial Assistance',kind:'money'})
}
export const DROMIC_FIELDS=[
  {key:'affected_families',label:'Affected Families',group:'Number of Affected',kind:'number',required:true},
  {key:'affected_persons',label:'Affected Persons',group:'Number of Affected',kind:'number',required:true},
  {key:'affected_4ps_families',label:'4Ps Families',group:'Number of Affected',kind:'number'},
  ...pair('evacuation_centers','Number of Evacuation Centers (ECs)','Displacement Data'),
  {key:'ec_latitude',label:'Latitude',group:'Evacuation Center Details',kind:'text'},
  {key:'ec_longitude',label:'Longitude',group:'Evacuation Center Details',kind:'text'},
  {key:'ec_name',label:'Name of Evacuation Center',group:'Evacuation Center Details',kind:'text'},
  {key:'ec_address',label:'Address',group:'Evacuation Center Details',kind:'text'},
  {key:'origin_brgy_name',label:'Origin of IDPs — Barangay Name',group:'Evacuation Center Details',kind:'text'},
  {key:'origin_brgy_count',label:'Origin of IDPs — Barangay Count',group:'Evacuation Center Details',kind:'number'},
  ...pair('inside_families','Inside ECs / Families','Number of Displaced'),
  ...pair('inside_persons','Inside ECs / Persons','Number of Displaced'),
  ...pair('outside_families','Outside ECs / Families','Number of Displaced'),
  ...pair('outside_persons','Outside ECs / Persons','Number of Displaced'),
  {key:'non_idp_families',label:'NON IDPs — Families',group:'Non IDPs',kind:'number'},
  {key:'non_idp_persons',label:'NON IDPs — Persons',group:'Non IDPs',kind:'number'},
  ...demographic,...vulnerable,
  {key:'latrine_compost_pit',label:'Latrines — Compost Pit',group:'Evacuation Center Facilities',kind:'number'},
  {key:'latrine_sealed',label:'Latrines — Sealed',group:'Evacuation Center Facilities',kind:'number'},
  {key:'toilet_male',label:'Toilet — Male',group:'Evacuation Center Facilities',kind:'number'},
  {key:'toilet_female',label:'Toilet — Female',group:'Evacuation Center Facilities',kind:'number'},
  {key:'toilet_common',label:'Toilet — Common',group:'Evacuation Center Facilities',kind:'number'},
  {key:'bathing_male',label:'Bathing Area — Male',group:'Evacuation Center Facilities',kind:'number'},
  {key:'bathing_female',label:'Bathing Area — Female',group:'Evacuation Center Facilities',kind:'number'},
  {key:'bathing_common',label:'Bathing Area — Common',group:'Evacuation Center Facilities',kind:'number'},
  ...facilities,...tents,
  {key:'damaged_totally',label:'Totally Damaged Houses',group:'Damaged Houses',kind:'number'},
  {key:'damaged_partially',label:'Partially Damaged Houses',group:'Damaged Houses',kind:'number'},
  ...assistance,
  {key:'province_served',label:'Province — No. of Served',group:'Stakeholder Assistance',kind:'number'},
  {key:'province_amount',label:'Province — Amount',group:'Stakeholder Assistance',kind:'money'},
  {key:'lgu_served',label:'LGU — No. of Served',group:'Stakeholder Assistance',kind:'number'},
  {key:'lgu_amount',label:'LGU — Amount',group:'Stakeholder Assistance',kind:'money'},
  {key:'ngo_amount',label:'NGOs — Amount',group:'Stakeholder Assistance',kind:'money'},
  {key:'others_amount',label:'Others — Amount',group:'Stakeholder Assistance',kind:'money'},
  {key:'remarks',label:'Remarks',group:'Remarks',kind:'textarea'}
]
export const GROUPS=[...new Set(DROMIC_FIELDS.map(f=>f.group))]
export const FIELD_MAP=Object.fromEntries(DROMIC_FIELDS.map(f=>[f.key,f]))
export const CORE_GROUPS=['Number of Affected','Displacement Data','Evacuation Center Details','Number of Displaced','Non IDPs','Damaged Houses','Stakeholder Assistance','Remarks']
