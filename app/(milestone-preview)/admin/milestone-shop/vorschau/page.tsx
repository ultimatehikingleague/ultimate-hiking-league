'use client'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabase'
import MilestoneShop, { type ShopReward } from '@/app/milestone-shop/MilestoneShop'

export default function Preview() {
 const t = useTranslations('milestones')
 const [rewards, setRewards] = useState<ShopReward[]>([])
 const [state,setState]=useState<'checkingAdmin' | 'adminSignIn' | 'adminOnly' | 'previewLoadError' | ''>('checkingAdmin')
 useEffect(()=>{let cancelled=false;async function load(){
  const {data:{user}}=await supabase.auth.getUser()
  if(!user){if(!cancelled)setState('adminSignIn');return}
  const {data:admin,error:authError}=await supabase.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle()
  if(authError||!admin){if(!cancelled)setState('adminOnly');return}
  const {data,error}=await supabase.from('reward_catalog').select('id,title,description,partner_name,points_cost,image_url,is_active,reward_type,redemption_url,redemption_instructions').order('display_position', { nullsFirst: false }).order('points_cost').order('id')
  if(!cancelled){setRewards((data ?? []).map(reward => ({ ...reward, is_available: false })));setState(error?'previewLoadError':'')}
 }void load();return()=>{cancelled=true}},[])
 if (!state) return <MilestoneShop previewRewards={rewards} />
 return (
   <main className="min-h-screen bg-[#080d16] px-6 py-12 text-white">
     <Link href="/admin/milestone-shop" className="text-cyan-300">← {t('manageRewards')}</Link>
     <p role="status" className="mt-8">{t(state)}</p>
   </main>
 )
}
