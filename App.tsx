import React, { useState, useEffect, useCallback, useRef } from 'react';

// ========== 게임 상수 ==========
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const PLAYER_SIZE = 40;
const PLAYER_SPEED = 4;
const ENEMY_SIZE = 35;
const XP_SIZE = 15;
const PICKUP_RANGE = 50;
const MAGNET_RANGE = 150;

// ========== 타입 정의 ==========
interface Position { x: number; y: number; }
interface Player extends Position { hp: number; maxHp: number; level: number; xp: number; xpToNext: number; }
interface Enemy extends Position { id: number; hp: number; maxHp: number; speed: number; emoji: string; damage: number; xpValue: number; }
interface Projectile extends Position { id: number; dx: number; dy: number; damage: number; pierce: number; hitEnemies: Set<number>; emoji: string; size: number; }
interface XPOrb extends Position { id: number; value: number; }
interface Weapon { id: string; name: string; emoji: string; damage: number; cooldown: number; lastFired: number; level: number; projectileCount: number; pierce: number; description: string; }
interface UpgradeOption { type: 'weapon' | 'stat'; id: string; name: string; emoji: string; description: string; }
type GameState = 'start' | 'playing' | 'levelup' | 'gameover' | 'victory';

// ========== 무기 정의 ==========
const WEAPON_DEFS: Record<string, Omit<Weapon, 'lastFired' | 'level'>> = {
  book: { id: 'book', name: '전공책', emoji: '📚', damage: 10, cooldown: 1200, projectileCount: 1, pierce: 1, description: '무거운 전공책을 던집니다' },
  pencil: { id: 'pencil', name: '연필', emoji: '✏️', damage: 5, cooldown: 400, projectileCount: 2, pierce: 0, description: '날카로운 연필을 빠르게 발사' },
  coffee: { id: 'coffee', name: '커피', emoji: '☕', damage: 15, cooldown: 2000, projectileCount: 1, pierce: 3, description: '뜨거운 커피가 관통합니다' },
  laptop: { id: 'laptop', name: '노트북', emoji: '💻', damage: 25, cooldown: 3000, projectileCount: 1, pierce: 5, description: '무거운 노트북! 고데미지' },
  eraser: { id: 'eraser', name: '지우개', emoji: '🧽', damage: 8, cooldown: 800, projectileCount: 3, pierce: 0, description: '지우개 3발 동시 발사' },
};

// ========== 적 정의 ==========
const ENEMY_TYPES = [
  { emoji: '🧑‍🏫', hp: 20, speed: 1.2, damage: 10, xpValue: 10 },
  { emoji: '👨‍🏫', hp: 40, speed: 1.0, damage: 15, xpValue: 20 },
  { emoji: '👩‍🏫', hp: 40, speed: 1.0, damage: 15, xpValue: 20 },
  { emoji: '🤓', hp: 60, speed: 0.8, damage: 20, xpValue: 30 },
  { emoji: '😈', hp: 100, speed: 1.5, damage: 25, xpValue: 50 },
  { emoji: '👿', hp: 150, speed: 0.6, damage: 30, xpValue: 80 },
];

// ========== 교실 오브젝트 ==========
interface ClassroomObject { x: number; y: number; type: string; }

const generateClassroomObjects = (): ClassroomObject[] => {
  const objects: ClassroomObject[] = [];
  for (let row = 0; row < 20; row++) {
    for (let col = 0; col < 20; col++) {
      objects.push({ x: (col - 10) * 200, y: (row - 10) * 150, type: 'desk' });
      objects.push({ x: (col - 10) * 200, y: (row - 10) * 150 + 40, type: 'chair' });
    }
  }
  for (let i = -5; i < 5; i++) objects.push({ x: i * 400, y: -800, type: 'blackboard' });
  for (let i = -10; i < 10; i++) {
    objects.push({ x: -1500, y: i * 200, type: 'window' });
    objects.push({ x: 1500, y: i * 200, type: 'window' });
  }
  for (let i = 0; i < 30; i++) {
    objects.push({ x: (Math.random() - 0.5) * 3000, y: (Math.random() - 0.5) * 3000, type: ['clock', 'plant', 'locker', 'trashcan'][Math.floor(Math.random() * 4)] });
  }
  return objects;
};

const ClassroomObject: React.FC<{ obj: ClassroomObject; offsetX: number; offsetY: number }> = ({ obj, offsetX, offsetY }) => {
  const x = GAME_WIDTH / 2 + obj.x - offsetX;
  const y = GAME_HEIGHT / 2 + obj.y - offsetY;
  if (x < -150 || x > GAME_WIDTH + 150 || y < -150 || y > GAME_HEIGHT + 150) return null;
  
  const base: React.CSSProperties = { position: 'absolute', imageRendering: 'pixelated' };
  
  if (obj.type === 'desk') return (
    <div style={{ ...base, left: x - 40, top: y - 20, width: 80, height: 40, background: 'linear-gradient(180deg, #8B5A2B 0%, #5D3A1A 100%)', border: '3px solid #4A2F15', borderRadius: 4, boxShadow: '0 4px 0 #3D2512' }}>
      <span style={{ position: 'absolute', top: 5, left: 10, fontSize: 12 }}>📖</span>
      <span style={{ position: 'absolute', top: 5, right: 10, fontSize: 10 }}>✏️</span>
    </div>
  );
  if (obj.type === 'chair') return <div style={{ ...base, left: x - 15, top: y - 15, width: 30, height: 30, background: 'linear-gradient(180deg, #CD853F 0%, #A0522D 100%)', border: '2px solid #8B4513', borderRadius: 3 }} />;
  if (obj.type === 'blackboard') return (
    <div style={{ ...base, left: x - 100, top: y - 40, width: 200, height: 80, background: 'linear-gradient(180deg, #2F4F4F 0%, #1C3333 100%)', border: '6px solid #8B7355', borderRadius: 4 }}>
      <span style={{ color: '#FFF', fontSize: 10, padding: 8, display: 'block', opacity: 0.7 }}>E = mc²</span>
    </div>
  );
  if (obj.type === 'window') return (
    <div style={{ ...base, left: x - 40, top: y - 50, width: 80, height: 100, background: 'linear-gradient(180deg, #87CEEB 0%, #B0E0E6 100%)', border: '6px solid #8B7355', borderRadius: 4 }}>
      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 4, background: '#8B7355', transform: 'translateX(-50%)' }} />
      <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 4, background: '#8B7355', transform: 'translateY(-50%)' }} />
      <span style={{ position: 'absolute', top: 5, left: 5, fontSize: 14 }}>☀️</span>
    </div>
  );
  if (obj.type === 'clock') return <div style={{ ...base, left: x - 15, top: y - 15, fontSize: 24 }}>🕐</div>;
  if (obj.type === 'plant') return <div style={{ ...base, left: x - 15, top: y - 25, fontSize: 28 }}>🪴</div>;
  if (obj.type === 'locker') return <div style={{ ...base, left: x - 20, top: y - 40, width: 40, height: 80, background: 'linear-gradient(180deg, #4682B4 0%, #336699 100%)', border: '3px solid #2F4F6F', borderRadius: 4 }} />;
  if (obj.type === 'trashcan') return <div style={{ ...base, left: x - 12, top: y - 20, fontSize: 24 }}>🗑️</div>;
  return null;
};

// ========== 메인 컴포넌트 ==========
const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('start');
  const [gameTime, setGameTime] = useState(0);
  const [kills, setKills] = useState(0);
  const [player, setPlayer] = useState<Player>({ x: 0, y: 0, hp: 100, maxHp: 100, level: 1, xp: 0, xpToNext: 10 });
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [xpOrbs, setXpOrbs] = useState<XPOrb[]>([]);
  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [upgradeOptions, setUpgradeOptions] = useState<UpgradeOption[]>([]);
  const [classroomObjects] = useState(() => generateClassroomObjects());
  const [stats, setStats] = useState({ damage: 1, speed: 1, pickupRange: 1, maxHp: 1, cooldown: 1 });
  const [camera, setCamera] = useState({ x: 0, y: 0 });
  
  const keysPressed = useRef<Set<string>>(new Set());
  const enemyIdRef = useRef(0);
  const projectileIdRef = useRef(0);
  const xpIdRef = useRef(0);
  const gameLoopRef = useRef<number>();
  const lastUpdateRef = useRef(Date.now());
  const playerRef = useRef(player);
  const enemiesRef = useRef(enemies);
  const gameTimeRef = useRef(0);
  
  useEffect(() => { playerRef.current = player; }, [player]);
  useEffect(() => { enemiesRef.current = enemies; }, [enemies]);
  useEffect(() => { gameTimeRef.current = gameTime; }, [gameTime]);

  const startGame = useCallback(() => {
    const p = { x: 0, y: 0, hp: 100, maxHp: 100, level: 1, xp: 0, xpToNext: 10 };
    setGameState('playing');
    setGameTime(0);
    gameTimeRef.current = 0;
    setKills(0);
    setPlayer(p);
    playerRef.current = p;
    setEnemies([]);
    setProjectiles([]);
    setXpOrbs([]);
    setWeapons([{ ...WEAPON_DEFS.book, level: 1, lastFired: 0 }]);
    setStats({ damage: 1, speed: 1, pickupRange: 1, maxHp: 1, cooldown: 1 });
    setCamera({ x: 0, y: 0 });
    enemyIdRef.current = 0;
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysPressed.current.add(e.code);
      if (e.code === 'Space' && gameState !== 'playing' && gameState !== 'levelup') startGame();
    };
    const up = (e: KeyboardEvent) => keysPressed.current.delete(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [gameState, startGame]);

  // 적 스폰
  useEffect(() => {
    if (gameState !== 'playing') return;
    const spawn = () => {
      const p = playerRef.current;
      const t = gameTimeRef.current;
      const angle = Math.random() * Math.PI * 2;
      const dist = 400 + Math.random() * 100;
      const mult = 1 + t / 60;
      const maxIdx = Math.min(Math.floor(t / 30), ENEMY_TYPES.length - 1);
      const type = ENEMY_TYPES[Math.floor(Math.random() * (maxIdx + 1))];
      setEnemies(prev => [...prev, {
        id: enemyIdRef.current++,
        x: p.x + Math.cos(angle) * dist,
        y: p.y + Math.sin(angle) * dist,
        hp: type.hp * mult, maxHp: type.hp * mult,
        speed: type.speed, emoji: type.emoji, damage: type.damage, xpValue: type.xpValue,
      }]);
    };
    for (let i = 0; i < 5; i++) spawn();
    const interval = setInterval(() => {
      const count = Math.min(3, 1 + Math.floor(gameTimeRef.current / 60));
      for (let i = 0; i < count; i++) spawn();
    }, 800);
    return () => clearInterval(interval);
  }, [gameState]);

  const generateUpgrades = useCallback(() => {
    const opts: UpgradeOption[] = [];
    const owned = weapons.map(w => w.id);
    weapons.forEach(w => { if (w.level < 8) opts.push({ type: 'weapon', id: w.id, name: `${w.name} Lv.${w.level + 1}`, emoji: w.emoji, description: `${w.name} 강화!` }); });
    Object.values(WEAPON_DEFS).filter(w => !owned.includes(w.id)).forEach(w => opts.push({ type: 'weapon', id: w.id, name: w.name, emoji: w.emoji, description: w.description }));
    opts.push({ type: 'stat', id: 'damage', name: '공격력 +10%', emoji: '⚔️', description: '데미지 증가' });
    opts.push({ type: 'stat', id: 'speed', name: '이동속도 +10%', emoji: '👟', description: '더 빠르게' });
    opts.push({ type: 'stat', id: 'maxHp', name: '최대체력 +20', emoji: '❤️', description: '체력 증가' });
    opts.push({ type: 'stat', id: 'cooldown', name: '쿨다운 -10%', emoji: '⏱️', description: '발사 속도 증가' });
    opts.push({ type: 'stat', id: 'pickupRange', name: '획득범위 +20%', emoji: '🧲', description: '획득 범위 증가' });
    setUpgradeOptions(opts.sort(() => Math.random() - 0.5).slice(0, 3));
  }, [weapons]);

  const selectUpgrade = useCallback((opt: UpgradeOption) => {
    if (opt.type === 'weapon') {
      if (weapons.find(w => w.id === opt.id)) setWeapons(prev => prev.map(w => w.id === opt.id ? { ...w, level: w.level + 1 } : w));
      else setWeapons(prev => [...prev, { ...WEAPON_DEFS[opt.id], level: 1, lastFired: 0 }]);
    } else {
      setStats(prev => {
        const s = { ...prev };
        if (opt.id === 'damage') s.damage *= 1.1;
        if (opt.id === 'speed') s.speed *= 1.1;
        if (opt.id === 'cooldown') s.cooldown *= 1.1;
        if (opt.id === 'pickupRange') s.pickupRange *= 1.2;
        if (opt.id === 'maxHp') { s.maxHp += 0.2; setPlayer(p => ({ ...p, maxHp: p.maxHp + 20, hp: p.hp + 20 })); }
        return s;
      });
    }
    setUpgradeOptions([]);
    setGameState('playing');
  }, [weapons]);

  // 게임 루프
  useEffect(() => {
    if (gameState !== 'playing') return;
    const loop = () => {
      const now = Date.now();
      const delta = (now - lastUpdateRef.current) / 1000;
      lastUpdateRef.current = now;

      setGameTime(t => { if (t + delta >= 300) setGameState('victory'); return t + delta; });

      setPlayer(prev => {
        let dx = 0, dy = 0;
        if (keysPressed.current.has('ArrowLeft') || keysPressed.current.has('KeyA')) dx -= 1;
        if (keysPressed.current.has('ArrowRight') || keysPressed.current.has('KeyD')) dx += 1;
        if (keysPressed.current.has('ArrowUp') || keysPressed.current.has('KeyW')) dy -= 1;
        if (keysPressed.current.has('ArrowDown') || keysPressed.current.has('KeyS')) dy += 1;
        if (dx && dy) { dx *= 0.707; dy *= 0.707; }
        const newP = { ...prev, x: prev.x + dx * PLAYER_SPEED * stats.speed, y: prev.y + dy * PLAYER_SPEED * stats.speed };
        setCamera({ x: newP.x, y: newP.y });
        return newP;
      });

      setEnemies(prev => {
        const p = playerRef.current;
        let dmg = 0;
        const updated = prev.map(e => {
          const dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy);
          if (dist < PLAYER_SIZE / 2 + ENEMY_SIZE / 2) dmg += e.damage * delta;
          return { ...e, x: e.x + (dx / dist) * e.speed, y: e.y + (dy / dist) * e.speed };
        });
        if (dmg > 0) setPlayer(pl => { const hp = pl.hp - dmg; if (hp <= 0) setGameState('gameover'); return { ...pl, hp: Math.max(0, hp) }; });
        return updated;
      });

      setWeapons(prev => {
        const p = playerRef.current;
        const es = enemiesRef.current;
        const newProj: Projectile[] = [];
        const updated = prev.map(w => {
          if (now - w.lastFired < w.cooldown / stats.cooldown) return w;
          let nearest: Enemy | null = null, nearDist = Infinity;
          es.forEach(e => { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < nearDist && d < 500) { nearDist = d; nearest = e; } });
          if (!nearest) return w;
          const angle = Math.atan2(nearest.y - p.y, nearest.x - p.x);
          const count = w.projectileCount + Math.floor(w.level / 2);
          for (let i = 0; i < count; i++) {
            const a = angle + (count > 1 ? (i - (count - 1) / 2) * 0.3 : 0);
            newProj.push({ id: projectileIdRef.current++, x: p.x, y: p.y, dx: Math.cos(a) * 8, dy: Math.sin(a) * 8, damage: (w.damage + w.level * 3) * stats.damage, pierce: w.pierce + Math.floor(w.level / 3), hitEnemies: new Set(), emoji: w.emoji, size: 25 + w.level * 2 });
          }
          return { ...w, lastFired: now };
        });
        if (newProj.length) setProjectiles(pr => [...pr, ...newProj]);
        return updated;
      });

      setProjectiles(prev => {
        const p = playerRef.current;
        return prev.filter(proj => {
          proj.x += proj.dx; proj.y += proj.dy;
          if (Math.hypot(proj.x - p.x, proj.y - p.y) > 600) return false;
          let remove = false;
          setEnemies(es => es.filter(e => {
            if (proj.hitEnemies.has(e.id)) return true;
            if (Math.hypot(proj.x - e.x, proj.y - e.y) < proj.size / 2 + ENEMY_SIZE / 2) {
              e.hp -= proj.damage;
              proj.hitEnemies.add(e.id);
              if (proj.hitEnemies.size > proj.pierce) remove = true;
              if (e.hp <= 0) { setKills(k => k + 1); setXpOrbs(o => [...o, { id: xpIdRef.current++, x: e.x, y: e.y, value: e.xpValue }]); return false; }
            }
            return true;
          }));
          return !remove;
        });
      });

      setXpOrbs(prev => {
        const p = playerRef.current;
        return prev.filter(o => {
          const dist = Math.hypot(o.x - p.x, o.y - p.y);
          const range = PICKUP_RANGE * stats.pickupRange;
          const magnet = MAGNET_RANGE * stats.pickupRange;
          if (dist < magnet && dist > range) { o.x += (p.x - o.x) / dist * 5; o.y += (p.y - o.y) / dist * 5; }
          if (dist < range) {
            setPlayer(pl => {
              const xp = pl.xp + o.value;
              if (xp >= pl.xpToNext) { setTimeout(() => { setGameState('levelup'); generateUpgrades(); }, 0); return { ...pl, level: pl.level + 1, xp: xp - pl.xpToNext, xpToNext: Math.floor(pl.xpToNext * 1.2), hp: Math.min(pl.hp + 10, pl.maxHp) }; }
              return { ...pl, xp };
            });
            return false;
          }
          return true;
        });
      });

      gameLoopRef.current = requestAnimationFrame(loop);
    };
    gameLoopRef.current = requestAnimationFrame(loop);
    return () => { if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current); };
  }, [gameState, stats, generateUpgrades]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#1a1a2e', fontFamily: "'Press Start 2P', cursive", color: 'white' }}>
      <div style={{ width: GAME_WIDTH, height: GAME_HEIGHT, background: '#C4A484', border: '4px solid #4a4a8a', borderRadius: 8, position: 'relative', overflow: 'hidden' }}>
        {/* 바닥 패턴 */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(90deg, #C4A484 0px, #C4A484 48px, #B8956E 48px, #B8956E 50px)', backgroundSize: '50px 50px', backgroundPosition: `${-camera.x % 50}px ${-camera.y % 50}px` }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg, transparent 0px, transparent 98px, #A67B5B 98px, #A67B5B 100px)', backgroundSize: '100px 100px', backgroundPosition: `${-camera.x % 100}px ${-camera.y % 100}px`, opacity: 0.3 }} />

        {gameState === 'playing' && (<>
          {classroomObjects.map((o, i) => <ClassroomObject key={i} obj={o} offsetX={camera.x} offsetY={camera.y} />)}
          {xpOrbs.map(o => <div key={o.id} style={{ position: 'absolute', left: GAME_WIDTH/2 + o.x - camera.x - XP_SIZE/2, top: GAME_HEIGHT/2 + o.y - camera.y - XP_SIZE/2, width: XP_SIZE, height: XP_SIZE, background: 'radial-gradient(circle, #00ff88, #00aa55)', borderRadius: '50%', boxShadow: '0 0 10px #00ff88', zIndex: 5 }} />)}
          {enemies.map(e => <div key={e.id} style={{ position: 'absolute', left: GAME_WIDTH/2 + e.x - camera.x - ENEMY_SIZE/2, top: GAME_HEIGHT/2 + e.y - camera.y - ENEMY_SIZE/2, width: ENEMY_SIZE, height: ENEMY_SIZE, fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>{e.emoji}{e.hp < e.maxHp && <div style={{ position: 'absolute', bottom: -8, left: 0, width: '100%', height: 4, background: '#333', borderRadius: 2 }}><div style={{ width: `${(e.hp/e.maxHp)*100}%`, height: '100%', background: '#f44', borderRadius: 2 }} /></div>}</div>)}
          {projectiles.map(p => <div key={p.id} style={{ position: 'absolute', left: GAME_WIDTH/2 + p.x - camera.x - p.size/2, top: GAME_HEIGHT/2 + p.y - camera.y - p.size/2, width: p.size, height: p.size, fontSize: p.size * 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `rotate(${Math.atan2(p.dy, p.dx)}rad)`, filter: 'drop-shadow(0 0 5px #ff0)', zIndex: 15 }}>{p.emoji}</div>)}
          <div style={{ position: 'absolute', left: GAME_WIDTH/2 - PLAYER_SIZE/2, top: GAME_HEIGHT/2 - PLAYER_SIZE/2, fontSize: 32, filter: 'drop-shadow(0 0 10px #0ff)', zIndex: 20 }}>🧑‍🎓</div>
          <div style={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', justifyContent: 'space-between', fontSize: 10, zIndex: 100, textShadow: '2px 2px #000' }}>
            <div><div>⏱️ {formatTime(gameTime)} / 5:00</div><div>💀 {kills}</div></div>
            <div style={{ textAlign: 'right' }}><div>Lv.{player.level}</div><div>🎯 {weapons.map(w => w.emoji).join(' ')}</div></div>
          </div>
          <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', width: 200, zIndex: 100 }}>
            <div style={{ width: '100%', height: 20, background: '#333', borderRadius: 10, border: '2px solid #555', overflow: 'hidden' }}><div style={{ width: `${(player.hp/player.maxHp)*100}%`, height: '100%', background: 'linear-gradient(90deg, #f44, #f66)' }} /></div>
            <div style={{ textAlign: 'center', fontSize: 8, marginTop: 5, textShadow: '1px 1px #000' }}>❤️ {Math.ceil(player.hp)} / {player.maxHp}</div>
          </div>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: '#222', zIndex: 100 }}><div style={{ width: `${(player.xp/player.xpToNext)*100}%`, height: '100%', background: 'linear-gradient(90deg, #0f8, #0fc)' }} /></div>
        </>)}

        {gameState === 'start' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', zIndex: 30 }}>
            <div style={{ fontSize: 40, marginBottom: 20 }}>🧑‍🎓</div>
            <div style={{ fontSize: 16, marginBottom: 10 }}>종강의 복수</div>
            <div style={{ fontSize: 12, marginBottom: 30, color: '#aaa' }}>서바이버</div>
            <div style={{ fontSize: 8, marginBottom: 20, color: '#888', textAlign: 'center', lineHeight: 2.5 }}>WASD / 방향키 - 이동<br/>공격은 자동!<br/>5분 생존하면 승리!</div>
            <div style={{ fontSize: 10, color: '#fc0', animation: 'blink 1s infinite' }}>PRESS SPACE TO START</div>
          </div>
        )}

        {gameState === 'levelup' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.9)', zIndex: 30 }}>
            <div style={{ fontSize: 14, marginBottom: 20, color: '#fc0' }}>🎉 LEVEL UP! 🎉</div>
            <div style={{ fontSize: 10, marginBottom: 20 }}>업그레이드를 선택하세요</div>
            <div style={{ display: 'flex', gap: 15 }}>
              {upgradeOptions.map((o, i) => (
                <button key={i} onClick={() => selectUpgrade(o)} style={{ width: 140, padding: 15, background: 'linear-gradient(180deg, #3a3a6a, #2a2a4a)', border: '3px solid #5a5a9a', borderRadius: 10, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <div style={{ fontSize: 30, marginBottom: 10 }}>{o.emoji}</div>
                  <div style={{ fontSize: 8, marginBottom: 8 }}>{o.name}</div>
                  <div style={{ fontSize: 6, color: '#aaa' }}>{o.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {gameState === 'gameover' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.9)', zIndex: 30 }}>
            <div style={{ fontSize: 20, marginBottom: 20, color: '#f44' }}>GAME OVER</div>
            <div style={{ fontSize: 10, marginBottom: 10 }}>⏱️ 생존: {formatTime(gameTime)}</div>
            <div style={{ fontSize: 10, marginBottom: 10 }}>💀 처치: {kills}</div>
            <div style={{ fontSize: 10, marginBottom: 30 }}>📊 레벨: {player.level}</div>
            <div style={{ fontSize: 10, color: '#fc0', animation: 'blink 1s infinite' }}>PRESS SPACE TO RETRY</div>
          </div>
        )}

        {gameState === 'victory' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.9)', zIndex: 30 }}>
            <div style={{ fontSize: 20, marginBottom: 20, color: '#fc0' }}>🎓 종강 성공! 🎓</div>
            <div style={{ fontSize: 12, marginBottom: 20, color: '#0f8' }}>VICTORY!</div>
            <div style={{ fontSize: 10, marginBottom: 10 }}>💀 총 처치: {kills}</div>
            <div style={{ fontSize: 10, marginBottom: 30 }}>📊 최종 레벨: {player.level}</div>
            <div style={{ fontSize: 10, color: '#fc0', animation: 'blink 1s infinite' }}>PRESS SPACE TO PLAY AGAIN</div>
          </div>
        )}
      </div>
      <style>{`@keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }`}</style>
    </div>
  );
};

export default App;
