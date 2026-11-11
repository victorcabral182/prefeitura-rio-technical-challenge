export default function Login({
  onEntrar,
}: {
  onEntrar: (email: string, senha: string) => void
}) {
  return (
    <main className="login">
      <h1>Corridas</h1>
      <form action={(dados) => onEntrar(String(dados.get('email')).trim(), String(dados.get('senha')))}>
        <label>
          E-mail
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          Senha
          <input name="senha" type="password" autoComplete="current-password" required />
        </label>
        <button type="submit">Entrar</button>
      </form>
    </main>
  )
}
