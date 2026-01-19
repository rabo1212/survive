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
interface Position {
  x: number;
  y: number;
}

interface Player extends Position {
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpToNext: number;
}

interface Enemy extends Position {
  id: number;
  hp: number;
  maxHp: number;
  speed: number;
  emoji: string;
  damage: number;
  xpValue: number;
}

interface Projectile extends Position {
  id: number;
  dx: number;
  dy: number;
  damage: number;
  pierce: number;
  hitEnemies: Set<number>;
  emoji: string;
  size: number;
}

interface XPOrb extends Position {
  id: number;
  value: number;
}

interface Weapon {
  id: string;
  name: string;
  emoji: string;
  damage: number;
  cooldown: number;
  lastFired: number;
  level: number;
  projectileCount: number;
  pierce: number;
  description: string;
}

interface UpgradeOption {
  type: 'weapon' | 'stat';
  id: string;
  name: string;
  emoji: string;
  description: string;
}

type GameState = 'start' | 'playing' | 'levelup' | 'gameover' | 'victory';

// ========== 무기 정의 ==========
const WEAPON_DEFS: Record<string, Omit<Weapon, 'lastFired' | 'level'>> = {
  book: {
    id: 'book',
    name: '전공책',
    emoji: '📚',
    damage: 10,
    cooldown: 1200,
    projectileCount: 1,
    pierce: 1,
    description: '무거운 전공책을 던집니다',
  },
  pencil: {
    id: 'pencil',
    name: '연필',
    emoji: '✏️',
    damage: 5,
    cooldown: 400,
    projectileCount: 2,
    pierce: 0,
    description: '날카로운 연필을 빠르게 발사',
  },
  coffee: {
    id: 'coffee',
    name: '커피',
    emoji: '☕',
    damage: 15,
    cooldown: 2000,
    projectileCount: 1,
    pierce: 3,
    description: '뜨거운 커피가 관통합니다',
  },
  laptop: {
    id: 'laptop',
    name: '노트북',
    emoji: '💻',
    damage: 25,
    cooldown: 3000,
    projectileCount: 1,
    pierce: 5,
    description: '무거운 노트북! 고데미지',
  },
  eraser: {
    id: 'eraser',
    name: '지우개',
    emoji: '🧽',
    damage: 8,
    cooldown: 800,
    projectileCount: 3,
    pierce: 0,
    description: '지우개 3발 동시 발사',
  },
};

// ========== 적 정의 ==========
const ENEMY_TYPES = [
  { emoji: '🧑‍🏫', hp: 20, speed: 1.2, damage: 10, xpValue: 10, name: '조교' },
  { emoji: '👨‍🏫', hp: 40, speed: 1.0, damage: 15, xpValue: 20, name: '교수' },
  { emoji: '👩‍🏫', hp: 40, speed: 1.0, damage: 15, xpValue: 20, name: '교수' },
  { emoji: '🤓', hp: 60, speed: 0.8, damage: 20, xpValue: 30, name: '학과장' },
  { emoji: '😈', hp: 100, speed: 1.5, damage: 25, xpValue: 50, name: '악마교수' },
  { emoji: '👿', hp: 150, speed: 0.6, damage: 30, xpValue: 80, name: '총장' },
];

// ========== 메인 컴포넌트 ==========
const App: React.FC = () => {
  // 게임 상태
  const [gameState, setGameState] = useState<GameState>('start');
  const [gameTime, setGameTime] = useState(0);
  const [kills, setKills] = useState(0);
  
  // 플레이어
  const [player, setPlayer] = useState<Player>({
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT / 2,
    hp: 100,
    maxHp: 100,
    level: 1,
    xp: 0,
    xpToNext: 10,
  });
  
  // 게임 오브젝트
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [xpOrbs, setXpOrbs] = useState<XPOrb[]>([]);
  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [upgradeOptions, setUpgradeOptions] = useState<UpgradeOption[]>([]);
  
  // 스탯
  const [stats, setStats] = useState({
    damage: 1,
    speed: 1,
    pickupRange: 1,
    maxHp: 1,
    cooldown: 1,
  });
  
  // Refs
  const keysPressed = useRef<Set<string>>(new Set());
  const enemyIdRef = useRef(0);
  const projectileIdRef = useRef(0);
  const xpIdRef = useRef(0);
  const gameLoopRef = useRef<number>();
  const lastUpdateRef = useRef(Date.now());
  
  // 카메라 오프셋 (플레이어 중심)
  const [camera, setCamera] = useState({ x: 0, y: 0 });

  // ========== 게임 초기화 ==========
  const startGame = useCallback(() => {
    setGameState('playing');
    setGameTime(0);
    setKills(0);
    setPlayer({
      x: 0,
      y: 0,
      hp: 100,
      maxHp: 100,
      level: 1,
      xp: 0,
      xpToNext: 10,
    });
    setEnemies([]);
    setProjectiles([]);
    setXpOrbs([]);
    setWeapons([{
      ...WEAPON_DEFS.book,
      level: 1,
      lastFired: 0,
    }]);
    setStats({
      damage: 1,
      speed: 1,
      pickupRange: 1,
      maxHp: 1,
      cooldown: 1,
    });
    setCamera({ x: 0, y: 0 });
    lastUpdateRef.current = Date.now();
  }, []);

  // ========== 키보드 이벤트 ==========
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.code);
      if (e.code === 'Space' && (gameState === 'start' || gameState === 'gameover' || gameState === 'victory')) {
        startGame();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.code);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, startGame]);

  // ========== 적 스폰 ==========
  const spawnEnemy = useCallback(() => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 400 + Math.random() * 100;
    const timeMultiplier = 1 + gameTime / 60;
    
    // 시간에 따라 더 강한 적 등장
    const availableTypes = ENEMY_TYPES.filter((_, i) => i <= Math.min(Math.floor(gameTime / 30), ENEMY_TYPES.length - 1));
    const enemyType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
    
    const newEnemy: Enemy = {
      id: enemyIdRef.current++,
      x: player.x + Math.cos(angle) * distance,
      y: player.y + Math.sin(angle) * distance,
      hp: enemyType.hp * timeMultiplier,
      maxHp: enemyType.hp * timeMultiplier,
      speed: enemyType.speed,
      emoji: enemyType.emoji,
      damage: enemyType.damage,
      xpValue: enemyType.xpValue,
    };
    
    setEnemies(prev => [...prev, newEnemy]);
  }, [player.x, player.y, gameTime]);

  // ========== 투사체 발사 ==========
  const fireWeapons = useCallback(() => {
    const now = Date.now();
    
    setWeapons(prevWeapons => {
      const newProjectiles: Projectile[] = [];
      
      const updatedWeapons = prevWeapons.map(weapon => {
        const adjustedCooldown = weapon.cooldown / stats.cooldown;
        if (now - weapon.lastFired < adjustedCooldown) return weapon;
        
        // 가장 가까운 적 찾기
        let nearestEnemy: Enemy | null = null;
        let nearestDist = Infinity;
        
        enemies.forEach(enemy => {
          const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
          if (dist < nearestDist && dist < 500) {
            nearestDist = dist;
            nearestEnemy = enemy;
          }
        });
        
        if (!nearestEnemy) return weapon;
        
        const baseAngle = Math.atan2(nearestEnemy.y - player.y, nearestEnemy.x - player.x);
        const projectileCount = weapon.projectileCount + Math.floor(weapon.level / 2);
        const spreadAngle = 0.3;
        
        for (let i = 0; i < projectileCount; i++) {
          const angleOffset = projectileCount > 1 
            ? (i - (projectileCount - 1) / 2) * spreadAngle 
            : 0;
          const angle = baseAngle + angleOffset;
          
          newProjectiles.push({
            id: projectileIdRef.current++,
            x: player.x,
            y: player.y,
            dx: Math.cos(angle) * 8,
            dy: Math.sin(angle) * 8,
            damage: (weapon.damage + weapon.level * 3) * stats.damage,
            pierce: weapon.pierce + Math.floor(weapon.level / 3),
            hitEnemies: new Set(),
            emoji: weapon.emoji,
            size: 25 + weapon.level * 2,
          });
        }
        
        return { ...weapon, lastFired: now };
      });
      
      if (newProjectiles.length > 0) {
        setProjectiles(prev => [...prev, ...newProjectiles]);
      }
      
      return updatedWeapons;
    });
  }, [enemies, player.x, player.y, stats.damage, stats.cooldown]);

  // ========== 레벨업 옵션 생성 ==========
  const generateUpgradeOptions = useCallback(() => {
    const options: UpgradeOption[] = [];
    
    // 새 무기 또는 기존 무기 업그레이드
    const ownedWeaponIds = weapons.map(w => w.id);
    const availableNewWeapons = Object.values(WEAPON_DEFS).filter(w => !ownedWeaponIds.includes(w.id));
    
    // 기존 무기 업그레이드
    weapons.forEach(w => {
      if (w.level < 8) {
        options.push({
          type: 'weapon',
          id: w.id,
          name: `${w.name} Lv.${w.level + 1}`,
          emoji: w.emoji,
          description: `${w.name} 강화!`,
        });
      }
    });
    
    // 새 무기
    availableNewWeapons.forEach(w => {
      options.push({
        type: 'weapon',
        id: w.id,
        name: w.name,
        emoji: w.emoji,
        description: w.description,
      });
    });
    
    // 스탯 업그레이드
    const statOptions: UpgradeOption[] = [
      { type: 'stat', id: 'damage', name: '공격력 +10%', emoji: '⚔️', description: '모든 무기 데미지 증가' },
      { type: 'stat', id: 'speed', name: '이동속도 +10%', emoji: '👟', description: '더 빠르게 이동' },
      { type: 'stat', id: 'maxHp', name: '최대체력 +20', emoji: '❤️', description: '체력 상한 증가' },
      { type: 'stat', id: 'cooldown', name: '쿨다운 -10%', emoji: '⏱️', description: '무기 발사 속도 증가' },
      { type: 'stat', id: 'pickupRange', name: '획득범위 +20%', emoji: '🧲', description: '경험치 획득 범위 증가' },
    ];
    
    options.push(...statOptions);
    
    // 랜덤으로 3개 선택
    const shuffled = options.sort(() => Math.random() - 0.5);
    setUpgradeOptions(shuffled.slice(0, 3));
  }, [weapons]);

  // ========== 업그레이드 선택 ==========
  const selectUpgrade = useCallback((option: UpgradeOption) => {
    if (option.type === 'weapon') {
      const existingWeapon = weapons.find(w => w.id === option.id);
      if (existingWeapon) {
        setWeapons(prev => prev.map(w => 
          w.id === option.id ? { ...w, level: w.level + 1 } : w
        ));
      } else {
        const newWeapon = WEAPON_DEFS[option.id];
        if (newWeapon) {
          setWeapons(prev => [...prev, { ...newWeapon, level: 1, lastFired: 0 }]);
        }
      }
    } else {
      setStats(prev => {
        const newStats = { ...prev };
        switch (option.id) {
          case 'damage': newStats.damage *= 1.1; break;
          case 'speed': newStats.speed *= 1.1; break;
          case 'maxHp': 
            newStats.maxHp += 0.2;
            setPlayer(p => ({ ...p, maxHp: p.maxHp + 20, hp: p.hp + 20 }));
            break;
          case 'cooldown': newStats.cooldown *= 1.1; break;
          case 'pickupRange': newStats.pickupRange *= 1.2; break;
        }
        return newStats;
      });
    }
    
    setUpgradeOptions([]);
    setGameState('playing');
  }, [weapons]);

  // ========== 메인 게임 루프 ==========
  useEffect(() => {
    if (gameState !== 'playing') return;

    const gameLoop = () => {
      const now = Date.now();
      const delta = (now - lastUpdateRef.current) / 1000;
      lastUpdateRef.current = now;

      // 시간 업데이트
      setGameTime(prev => {
        const newTime = prev + delta;
        // 5분(300초) 생존 시 승리
        if (newTime >= 300) {
          setGameState('victory');
        }
        return newTime;
      });

      // 플레이어 이동
      setPlayer(prev => {
        let dx = 0, dy = 0;
        if (keysPressed.current.has('ArrowLeft') || keysPressed.current.has('KeyA')) dx -= 1;
        if (keysPressed.current.has('ArrowRight') || keysPressed.current.has('KeyD')) dx += 1;
        if (keysPressed.current.has('ArrowUp') || keysPressed.current.has('KeyW')) dy -= 1;
        if (keysPressed.current.has('ArrowDown') || keysPressed.current.has('KeyS')) dy += 1;
        
        if (dx !== 0 && dy !== 0) {
          dx *= 0.707;
          dy *= 0.707;
        }
        
        const speed = PLAYER_SPEED * stats.speed;
        return {
          ...prev,
          x: prev.x + dx * speed,
          y: prev.y + dy * speed,
        };
      });

      // 카메라 업데이트
      setPlayer(prev => {
        setCamera({ x: prev.x, y: prev.y });
        return prev;
      });

      // 적 이동 및 플레이어 충돌
      setEnemies(prev => {
        let playerDamage = 0;
        
        const updated = prev.map(enemy => {
          const dx = player.x - enemy.x;
          const dy = player.y - enemy.y;
          const dist = Math.hypot(dx, dy);
          
          // 플레이어 충돌
          if (dist < PLAYER_SIZE / 2 + ENEMY_SIZE / 2) {
            playerDamage += enemy.damage * delta;
          }
          
          // 적 이동
          const speed = enemy.speed;
          return {
            ...enemy,
            x: enemy.x + (dx / dist) * speed,
            y: enemy.y + (dy / dist) * speed,
          };
        });
        
        if (playerDamage > 0) {
          setPlayer(p => {
            const newHp = p.hp - playerDamage;
            if (newHp <= 0) {
              setGameState('gameover');
            }
            return { ...p, hp: Math.max(0, newHp) };
          });
        }
        
        return updated;
      });

      // 투사체 이동 및 충돌
      setProjectiles(prev => {
        return prev.filter(proj => {
          proj.x += proj.dx;
          proj.y += proj.dy;
          
          // 화면 밖 제거
          const dist = Math.hypot(proj.x - player.x, proj.y - player.y);
          if (dist > 600) return false;
          
          // 적과 충돌
          let shouldRemove = false;
          setEnemies(enemies => {
            return enemies.filter(enemy => {
              if (proj.hitEnemies.has(enemy.id)) return true;
              
              const hitDist = Math.hypot(proj.x - enemy.x, proj.y - enemy.y);
              if (hitDist < proj.size / 2 + ENEMY_SIZE / 2) {
                enemy.hp -= proj.damage;
                proj.hitEnemies.add(enemy.id);
                
                if (proj.hitEnemies.size > proj.pierce) {
                  shouldRemove = true;
                }
                
                if (enemy.hp <= 0) {
                  // 적 처치
                  setKills(k => k + 1);
                  setXpOrbs(orbs => [...orbs, {
                    id: xpIdRef.current++,
                    x: enemy.x,
                    y: enemy.y,
                    value: enemy.xpValue,
                  }]);
                  return false;
                }
              }
              return true;
            });
          });
          
          return !shouldRemove;
        });
      });

      // 경험치 오브 획득
      setXpOrbs(prev => {
        return prev.filter(orb => {
          const dist = Math.hypot(orb.x - player.x, orb.y - player.y);
          const range = PICKUP_RANGE * stats.pickupRange;
          const magnetRange = MAGNET_RANGE * stats.pickupRange;
          
          // 자석 효과
          if (dist < magnetRange && dist > range) {
            const dx = player.x - orb.x;
            const dy = player.y - orb.y;
            orb.x += (dx / dist) * 5;
            orb.y += (dy / dist) * 5;
          }
          
          // 획득
          if (dist < range) {
            setPlayer(p => {
              const newXp = p.xp + orb.value;
              if (newXp >= p.xpToNext) {
                // 레벨업!
                setTimeout(() => {
                  setGameState('levelup');
                  generateUpgradeOptions();
                }, 0);
                return {
                  ...p,
                  level: p.level + 1,
                  xp: newXp - p.xpToNext,
                  xpToNext: Math.floor(p.xpToNext * 1.2),
                  hp: Math.min(p.hp + 10, p.maxHp), // 레벨업 시 체력 회복
                };
              }
              return { ...p, xp: newXp };
            });
            return false;
          }
          return true;
        });
      });

      // 무기 발사
      fireWeapons();

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [gameState, fireWeapons, generateUpgradeOptions, stats, player.x, player.y]);

  // ========== 적 스폰 타이머 ==========
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const spawnRate = Math.max(200, 1000 - gameTime * 3);
    const interval = setInterval(spawnEnemy, spawnRate);
    
    return () => clearInterval(interval);
  }, [gameState, spawnEnemy, gameTime]);

  // ========== 시간 포맷 ==========
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ========== 렌더링 ==========
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      fontFamily: "'Press Start 2P', cursive",
      color: 'white',
      overflow: 'hidden',
    }}>
      {/* 게임 영역 */}
      <div style={{
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        background: 'linear-gradient(180deg, #2a2a4a 0%, #1a1a3a 100%)',
        border: '4px solid #4a4a8a',
        borderRadius: 8,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 0 50px rgba(100, 100, 200, 0.3)',
      }}>
        {/* 배경 그리드 */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          backgroundPosition: `${-camera.x % 50}px ${-camera.y % 50}px`,
        }} />

        {gameState === 'playing' && (
          <>
            {/* 경험치 오브 */}
            {xpOrbs.map(orb => (
              <div key={orb.id} style={{
                position: 'absolute',
                left: GAME_WIDTH / 2 + orb.x - camera.x - XP_SIZE / 2,
                top: GAME_HEIGHT / 2 + orb.y - camera.y - XP_SIZE / 2,
                width: XP_SIZE,
                height: XP_SIZE,
                background: 'radial-gradient(circle, #00ff88 0%, #00aa55 100%)',
                borderRadius: '50%',
                boxShadow: '0 0 10px #00ff88',
              }} />
            ))}

            {/* 적 */}
            {enemies.map(enemy => (
              <div key={enemy.id} style={{
                position: 'absolute',
                left: GAME_WIDTH / 2 + enemy.x - camera.x - ENEMY_SIZE / 2,
                top: GAME_HEIGHT / 2 + enemy.y - camera.y - ENEMY_SIZE / 2,
                width: ENEMY_SIZE,
                height: ENEMY_SIZE,
                fontSize: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                filter: enemy.hp < enemy.maxHp * 0.5 ? 'brightness(1.5) saturate(2)' : 'none',
              }}>
                {enemy.emoji}
                {/* HP 바 */}
                {enemy.hp < enemy.maxHp && (
                  <div style={{
                    position: 'absolute',
                    bottom: -8,
                    left: 0,
                    width: '100%',
                    height: 4,
                    background: '#333',
                    borderRadius: 2,
                  }}>
                    <div style={{
                      width: `${(enemy.hp / enemy.maxHp) * 100}%`,
                      height: '100%',
                      background: '#ff4444',
                      borderRadius: 2,
                    }} />
                  </div>
                )}
              </div>
            ))}

            {/* 투사체 */}
            {projectiles.map(proj => (
              <div key={proj.id} style={{
                position: 'absolute',
                left: GAME_WIDTH / 2 + proj.x - camera.x - proj.size / 2,
                top: GAME_HEIGHT / 2 + proj.y - camera.y - proj.size / 2,
                width: proj.size,
                height: proj.size,
                fontSize: proj.size * 0.8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `rotate(${Math.atan2(proj.dy, proj.dx)}rad)`,
                filter: 'drop-shadow(0 0 5px #ffff00)',
              }}>
                {proj.emoji}
              </div>
            ))}

            {/* 플레이어 */}
            <div style={{
              position: 'absolute',
              left: GAME_WIDTH / 2 - PLAYER_SIZE / 2,
              top: GAME_HEIGHT / 2 - PLAYER_SIZE / 2,
              width: PLAYER_SIZE,
              height: PLAYER_SIZE,
              fontSize: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              filter: 'drop-shadow(0 0 10px #00ffff)',
              zIndex: 10,
            }}>
              🧑‍🎓
            </div>

            {/* HUD */}
            <div style={{
              position: 'absolute',
              top: 10,
              left: 10,
              right: 10,
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 10,
              zIndex: 20,
            }}>
              <div>
                <div style={{ marginBottom: 5 }}>⏱️ {formatTime(gameTime)} / 5:00</div>
                <div>💀 {kills}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ marginBottom: 5 }}>Lv.{player.level}</div>
                <div>🎯 {weapons.map(w => w.emoji).join(' ')}</div>
              </div>
            </div>

            {/* HP 바 */}
            <div style={{
              position: 'absolute',
              bottom: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 200,
              zIndex: 20,
            }}>
              <div style={{
                width: '100%',
                height: 20,
                background: '#333',
                borderRadius: 10,
                border: '2px solid #555',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${(player.hp / player.maxHp) * 100}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, #ff4444, ${player.hp > player.maxHp * 0.3 ? '#ff6666' : '#ff0000'})`,
                  transition: 'width 0.1s',
                }} />
              </div>
              <div style={{ textAlign: 'center', fontSize: 8, marginTop: 5 }}>
                ❤️ {Math.ceil(player.hp)} / {player.maxHp}
              </div>
            </div>

            {/* XP 바 */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 6,
              background: '#222',
              zIndex: 20,
            }}>
              <div style={{
                width: `${(player.xp / player.xpToNext) * 100}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #00ff88, #00ffcc)',
                transition: 'width 0.1s',
              }} />
            </div>
          </>
        )}

        {/* 시작 화면 */}
        {gameState === 'start' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.8)',
            zIndex: 30,
          }}>
            <div style={{ fontSize: 40, marginBottom: 20 }}>🧑‍🎓</div>
            <div style={{ fontSize: 16, marginBottom: 10, textAlign: 'center' }}>
              종강의 복수
            </div>
            <div style={{ fontSize: 12, marginBottom: 30, color: '#aaa' }}>
              서바이버
            </div>
            <div style={{ fontSize: 8, marginBottom: 20, color: '#888', textAlign: 'center', lineHeight: 2.5 }}>
              WASD / 방향키 - 이동<br/>
              공격은 자동!<br/>
              5분 생존하면 승리!
            </div>
            <div style={{
              fontSize: 10,
              color: '#ffcc00',
              animation: 'blink 1s infinite',
            }}>
              PRESS SPACE TO START
            </div>
          </div>
        )}

        {/* 레벨업 화면 */}
        {gameState === 'levelup' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.9)',
            zIndex: 30,
          }}>
            <div style={{ fontSize: 14, marginBottom: 20, color: '#ffcc00' }}>
              🎉 LEVEL UP! 🎉
            </div>
            <div style={{ fontSize: 10, marginBottom: 20 }}>
              업그레이드를 선택하세요
            </div>
            <div style={{ display: 'flex', gap: 15 }}>
              {upgradeOptions.map((option, i) => (
                <button
                  key={i}
                  onClick={() => selectUpgrade(option)}
                  style={{
                    width: 140,
                    padding: 15,
                    background: 'linear-gradient(180deg, #3a3a6a 0%, #2a2a4a 100%)',
                    border: '3px solid #5a5a9a',
                    borderRadius: 10,
                    color: 'white',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'transform 0.1s, border-color 0.1s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.borderColor = '#ffcc00';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.borderColor = '#5a5a9a';
                  }}
                >
                  <div style={{ fontSize: 30, marginBottom: 10 }}>{option.emoji}</div>
                  <div style={{ fontSize: 8, marginBottom: 8 }}>{option.name}</div>
                  <div style={{ fontSize: 6, color: '#aaa' }}>{option.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 게임오버 화면 */}
        {gameState === 'gameover' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.9)',
            zIndex: 30,
          }}>
            <div style={{ fontSize: 20, marginBottom: 20, color: '#ff4444' }}>
              GAME OVER
            </div>
            <div style={{ fontSize: 10, marginBottom: 10 }}>
              ⏱️ 생존 시간: {formatTime(gameTime)}
            </div>
            <div style={{ fontSize: 10, marginBottom: 10 }}>
              💀 처치 수: {kills}
            </div>
            <div style={{ fontSize: 10, marginBottom: 30 }}>
              📊 레벨: {player.level}
            </div>
            <div style={{
              fontSize: 10,
              color: '#ffcc00',
              animation: 'blink 1s infinite',
            }}>
              PRESS SPACE TO RETRY
            </div>
          </div>
        )}

        {/* 승리 화면 */}
        {gameState === 'victory' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.9)',
            zIndex: 30,
          }}>
            <div style={{ fontSize: 20, marginBottom: 20, color: '#ffcc00' }}>
              🎓 종강 성공! 🎓
            </div>
            <div style={{ fontSize: 12, marginBottom: 20, color: '#00ff88' }}>
              VICTORY!
            </div>
            <div style={{ fontSize: 10, marginBottom: 10 }}>
              💀 총 처치: {kills}
            </div>
            <div style={{ fontSize: 10, marginBottom: 30 }}>
              📊 최종 레벨: {player.level}
            </div>
            <div style={{
              fontSize: 10,
              color: '#ffcc00',
              animation: 'blink 1s infinite',
            }}>
              PRESS SPACE TO PLAY AGAIN
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default App;
