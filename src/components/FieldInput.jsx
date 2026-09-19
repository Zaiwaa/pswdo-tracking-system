export default function FieldInput({field,value,onChange,issue,disabled}){
 const cls=issue?.severity==='RED'?'field error':issue?.severity==='ORANGE'?'field warning':'field'
 const props={disabled,value:value??'',onChange:e=>onChange(field.key,field.kind==='number'||field.kind==='money'?(e.target.value===''?'':Number(e.target.value)):e.target.value)}
 return <label className={cls}><span>{field.label}{field.required&&<em>*</em>}</span>{field.kind==='textarea'?<textarea {...props}/>:<input type={field.kind==='number'||field.kind==='money'?'number':'text'} min={field.kind==='number'||field.kind==='money'?0:undefined} step={field.kind==='money'?'0.01':'1'} {...props}/>} {issue&&<small>{issue.message}</small>}</label>
}
