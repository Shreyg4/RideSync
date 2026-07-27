import { supabase } from "@/src/lib/supabase"
import { Session, User } from "@supabase/supabase-js"
import { createContext, useContext, useEffect, useState } from "react"

interface AuthContextType{
  session: Session | null;
  user: User | null;
  loading: boolean;

  signUp:(username:string, email:string, password:string)=>Promise<void>;
  signIn:(email:string, password:string)=>Promise<void>;
  signOut:()=>Promise<void>;
}
const AuthContext = createContext<AuthContextType | null>(null)

export const AuthProvider=({children}:{children:React.ReactNode})=>{
  const[session, setSession] = useState<Session | null>(null)
  const[user, setUser] = useState<User | null>(null)
  const[loading, setLoading] = useState(true)

  useEffect(() =>{
    const InitializeSession = async() => {
      //Check for session
      const{data:{session}} = await supabase.auth.getSession()
      //If session exists retreive it
      setSession(session)
      setUser(session?.user??null)
      setLoading(false)
    }
    InitializeSession();

    const {data:{subscription}} = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user??null)
        setLoading(false)
      }
    )
    return() => {
      subscription.unsubscribe();
    }
  },[])

  const signUp = async(username:string, email:string, password:string) => {
    const{error}=await supabase.auth.signUp({options: {data: { username }}, email, password})
    if(error){
      throw error;
    }
  }

  const signIn = async(email:string, password:string) => {
    const{error}=await supabase.auth.signInWithPassword({email, password})
    if(error){
      throw error;
    }
  }

  const signOut = async() => {
    const{error}=await supabase.auth.signOut()
    if(error){
      throw error;
    }
  }

  return(
    <AuthContext.Provider value={{session, user, loading, signIn, signUp, signOut}}>
      {children}
    </AuthContext.Provider>
  )
}
export const useAuth=() => {
  const context=useContext(AuthContext)
  if(!context){
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}