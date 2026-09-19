import { useEffect,useState } from 'react'
import { Navigate,Route,Routes } from 'react-router-dom'
import { supabase,configured } from './lib/supabase'
import Layout from './components/Layout'
import { Login,Register } from './pages/Auth'
import LGUDashboard from './pages/LGUDashboard'
import CurrentReport from './pages/CurrentReport'
import ReportEditor from './pages/ReportEditor'
import ProvincialDashboard from './pages/ProvincialDashboard'
import ReviewReport from './pages/ReviewReport'
import SitReps from './pages/SitReps'
import History from './pages/History'
import Notifications from './pages/Notifications'
import Admin from './pages/Admin'
import Approvals from './pages/Approvals'
import Profile from './pages/Profile'
import Operations from './pages/Operations'
import Chat from './pages/Chat'

export default function App(){
  const [session,setSession]=useState(undefined)
  const [profile,setProfile]=useState(undefined)
  const [profileError,setProfileError]=useState('')

  useEffect(()=>{
    if(!configured){setSession(null);return}
    let active=true
    supabase.auth.getSession().then(({data,error})=>{
      if(!active)return
      if(error){console.error('getSession',error);setSession(null);return}
      setSession(data?.session||null)
    })
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,nextSession)=>{
      if(active)setSession(nextSession||null)
    })
    return()=>{active=false;subscription.unsubscribe()}
  },[])

  useEffect(()=>{
    if(!session){setProfile(undefined);setProfileError('');return}
    let active=true
    setProfile(undefined)
    setProfileError('')
    ;(async()=>{
      const {data,error}=await supabase.from('profiles').select('*').eq('id',session.user.id).maybeSingle()
      if(!active)return
      if(error){
        console.error('Profile load failed',error)
        setProfileError(error.message)
        setProfile(null)
        return
      }
      if(!data){
        setProfileError('Your Supabase Auth user exists, but no matching public.profiles record was found.')
        setProfile(null)
        return
      }
      setProfile(data)
    })()
    return()=>{active=false}
  },[session?.user?.id])

  if(session===undefined)return <div className="loading full">Starting secure session…</div>

  return <Routes>
    <Route path="/login" element={session?<Navigate to="/" replace/>:<Login/>}/>
    <Route path="/register" element={session?<Navigate to="/" replace/>:<Register/>}/>
    <Route path="*" element={
      !session ? <Navigate to="/login" replace/> :
      profile===undefined ? <div className="loading full">Loading your DROMIC account…</div> :
      profileError ? <ProfileProblem message={profileError}/> :
      !profile?.approved ? <Pending profile={profile}/> :
      <Protected profile={profile} onProfileUpdated={setProfile}/>
    }/>
  </Routes>
}

function ProfileProblem({message}){
  return <div className="auth-page"><div className="auth-card">
    <h2>Account profile could not be loaded</h2>
    <p>You are authenticated with Supabase, but the DROMIC profile record is not available.</p>
    <div className="alert red">{message}</div>
    <p style={{fontSize:13}}>Run the AUTH-REPAIR.sql check in Supabase SQL Editor, then reload this page.</p>
    <button className="btn secondary" onClick={()=>supabase.auth.signOut()}>Sign out</button>
  </div></div>
}

function Pending({profile}){const pswdo=profile?.role==='pswdo';return <div className="auth-page"><div className="auth-card"><h2>{pswdo?'PSWDO account awaiting administrator authorization':'LGU account awaiting PSWDO approval'}</h2><p>{pswdo?'Your account was created successfully. A System Administrator must authorize the PSWDO role before provincial operations access is activated.':'Your login is working. A PSWDO authorized user must verify your LGU assignment and approve reporting access.'}</p>{profile?.email&&<div className="alert blue">Signed in as {profile.email}</div>}<button className="btn secondary" onClick={()=>supabase.auth.signOut()}>Sign out</button></div></div>}

function Protected({profile,onProfileUpdated}){
  const isOps=['pswdo','admin'].includes(profile.role)
  return <Layout profile={profile}><Routes>
    <Route path="/" element={profile.role==='lgu'?<LGUDashboard profile={profile}/>:profile.role==='viewer'?<SitReps profile={profile}/>:<ProvincialDashboard/>}/>
    {profile.role==='lgu'&&<Route path="/current-report" element={<CurrentReport profile={profile}/>}/>}
    <Route path="/report/:id" element={<ReportEditor profile={profile}/>}/>
    {isOps&&<Route path="/review/:id" element={<ReviewReport/>}/>} 
    {isOps&&<Route path="/approvals" element={<Approvals/>}/>} 
    <Route path="/history" element={<History profile={profile}/>}/>
    <Route path="/notifications" element={<Notifications profile={profile}/>}/>
    <Route path="/chat" element={<Chat profile={profile}/>}/>
    <Route path="/profile" element={<Profile profile={profile} onProfileUpdated={onProfileUpdated}/>}/>
    {isOps&&<Route path="/sitrep" element={<SitReps profile={profile}/>}/>} 
    {isOps&&<Route path="/operations" element={<Operations profile={profile}/>}/>} 
    {profile.role==='admin'&&<Route path="/admin" element={<Admin/>}/>} 
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></Layout>
}
