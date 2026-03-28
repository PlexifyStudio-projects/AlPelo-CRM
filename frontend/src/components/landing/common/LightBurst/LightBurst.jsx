export default function LightBurst({
  position = 'bottom',
  color = 'purple',
  intensity = 'medium',
  className = ''
}) {
  const colorMap = {
    purple: ['rgba(139, 92, 246, 0.4)', 'rgba(236, 72, 153, 0.2)', 'transparent'],
    pink: ['rgba(236, 72, 153, 0.4)', 'rgba(249, 115, 22, 0.2)', 'transparent'],
    mixed: ['rgba(139, 92, 246, 0.3)', 'rgba(236, 72, 153, 0.25)', 'rgba(249, 115, 22, 0.15)', 'transparent'],
  };

  const positionMap = {
    bottom: 'center bottom',
    top: 'center top',
    center: 'center center',
    'top-right': '80% 20%',
    'bottom-left': '20% 80%',
  };

  const sizeMap = {
    small: { width: '80%', height: '50%' },
    medium: { width: '120%', height: '70%' },
    large: { width: '150%', height: '90%' },
  };

  const colors = colorMap[color] || colorMap.purple;
  const size = sizeMap[intensity] || sizeMap.medium;

  return (
    <div
      className={`light-burst ${className}`}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <div
        className="light-burst__glow"
        style={{
          position: 'absolute',
          width: size.width,
          height: size.height,
          left: '50%',
          transform: 'translateX(-50%)',
          ...(position === 'bottom' ? { bottom: '-20%' } : position === 'top' ? { top: '-20%' } : { top: '50%', transform: 'translate(-50%, -50%)' }),
          background: `radial-gradient(ellipse at ${positionMap[position]}, ${colors.join(', ')})`,
          filter: 'blur(40px)',
        }}
      />
    </div>
  );
}
