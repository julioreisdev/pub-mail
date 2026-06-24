import logoPubmail from 'assets/images/logo_pubmail.png';

// Logo "larga" (468x109). Usada na sidebar aberta, no header e no login/cadastro.
const Logo = ({ height = 34 }) => {
  return (
    <img
      src={logoPubmail}
      alt="Pub Mail"
      style={{
        display: 'block',
        height,
        width: 'auto',
        maxWidth: '100%',
        objectFit: 'contain'
      }}
    />
  );
};

export default Logo;
