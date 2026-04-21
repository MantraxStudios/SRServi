import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faLock, faArrowLeft, faUserCog, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';

const API = 'https://srservi2.srautomatic.com';

function WorkerLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch(API + '/api/workers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al iniciar sesión');
      localStorage.setItem('workerToken', data.token);
      localStorage.setItem('worker', JSON.stringify(data.worker));
      navigate('/worker-panel');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight:'100vh', background:'#0a0a0f', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', padding:'24px 20px',
      position:'relative', overflow:'hidden', fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif',
    }}>
      <div style={{position:'absolute',top:'-20%',left:'-10%',width:400,height:400,background:'radial-gradient(circle,rgba(212,175,55,0.07) 0%,transparent 70%)',pointerEvents:'none'}}/>
      <div style={{position:'absolute',bottom:'-15%',right:'-10%',width:350,height:350,background:'radial-gradient(circle,rgba(212,175,55,0.05) 0%,transparent 70%)',pointerEvents:'none'}}/>

      <button onClick={() => navigate('/')} style={{position:'absolute',top:20,left:20,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,color:'rgba(255,255,255,0.5)',padding:'8px 14px',fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',gap:6,fontWeight:600}}>
        <FontAwesomeIcon icon={faArrowLeft} /> Volver
      </button>

      <div style={{width:'100%',maxWidth:400,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:24,padding:'40px 28px',backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',position:'relative',zIndex:1}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{width:72,height:72,background:'linear-gradient(135deg,rgba(212,175,55,0.2),rgba(212,175,55,0.35))',border:'1px solid rgba(212,175,55,0.3)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',fontSize:28,color:'#D4AF37'}}>
            <FontAwesomeIcon icon={faUserCog} />
          </div>
          <h1 style={{fontSize:24,fontWeight:800,color:'#fff',margin:'0 0 6px',letterSpacing:'-0.02em'}}>Panel de Trabajadores</h1>
          <p style={{fontSize:14,color:'rgba(255,255,255,0.4)',margin:0}}>Ingresa tus credenciales para acceder</p>
        </div>

        {error && (
          <div style={{background:'rgba(239,68,68,0.12)',border:'1px solid rgba(239,68,68,0.25)',color:'#fca5a5',padding:'12px 16px',borderRadius:12,fontSize:13,textAlign:'center',marginBottom:20}}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:14}}>
          <div style={{position:'relative'}}>
            <FontAwesomeIcon icon={faUser} style={{position:'absolute',left:16,top:'50%',transform:'translateY(-50%)',color:'rgba(255,255,255,0.3)',fontSize:14,pointerEvents:'none'}}/>
            <input
              type="text" placeholder="Usuario" value={username}
              onChange={e => setUsername(e.target.value)} required autoComplete="username"
              style={{width:'100%',padding:'15px 16px 15px 44px',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:12,color:'#fff',fontSize:15,outline:'none',boxSizing:'border-box'}}
              onFocus={e=>e.target.style.borderColor='rgba(212,175,55,0.6)'}
              onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.1)'}
            />
          </div>

          <div style={{position:'relative'}}>
            <FontAwesomeIcon icon={faLock} style={{position:'absolute',left:16,top:'50%',transform:'translateY(-50%)',color:'rgba(255,255,255,0.3)',fontSize:14,pointerEvents:'none'}}/>
            <input
              type={showPass?'text':'password'} placeholder="Contraseña" value={password}
              onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
              style={{width:'100%',padding:'15px 44px 15px 44px',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:12,color:'#fff',fontSize:15,outline:'none',boxSizing:'border-box'}}
              onFocus={e=>e.target.style.borderColor='rgba(212,175,55,0.6)'}
              onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.1)'}
            />
            <button type="button" onClick={()=>setShowPass(v=>!v)} style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'rgba(255,255,255,0.35)',cursor:'pointer',fontSize:14,padding:4}}>
              <FontAwesomeIcon icon={showPass?faEyeSlash:faEye}/>
            </button>
          </div>

          <button type="submit" disabled={loading} style={{marginTop:6,padding:'16px',background:loading?'rgba(212,175,55,0.4)':'linear-gradient(135deg,#D4AF37,#b8962e)',color:'#0a0a0a',border:'none',borderRadius:12,fontSize:15,fontWeight:800,cursor:loading?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
            {loading ? (<><div style={{width:16,height:16,border:'2px solid rgba(0,0,0,0.3)',borderTopColor:'#000',borderRadius:'50%',animation:'wSpin 0.8s linear infinite'}}/>Iniciando...</>) : 'Iniciar Sesión'}
          </button>
        </form>
      </div>

      <p style={{marginTop:28,fontSize:12,color:'rgba(255,255,255,0.2)',position:'relative',zIndex:1}}>
        Powered by <span style={{color:'#D4AF37'}}>SRServi</span>
      </p>

      <style>{`@keyframes wSpin{to{transform:rotate(360deg)}} input::placeholder{color:rgba(255,255,255,0.3)}`}</style>
    </div>
  );
}

export default WorkerLogin;
