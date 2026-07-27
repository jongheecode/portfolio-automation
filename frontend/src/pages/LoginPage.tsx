import { api } from '../api/client'

function LoginPage() {
  return (
    <main>
      <h1>Portfolio Automation</h1>
      <p>GitHub 커밋을 기반으로 기록을 남기고, 이후 블로그·포트폴리오 PDF 자동 생성까지 이어지는 개인 서비스입니다.</p>
      <a href={api.loginUrl()}>
        <button type="button">GitHub로 로그인</button>
      </a>
    </main>
  )
}

export default LoginPage
