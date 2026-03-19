import FileSaver from 'https://cdn.jsdelivr.net/npm/file-saver/+esm'
import {
  createRef,
  css,
  html,
  LitElement,
  map,
  ref,
  when,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js'

const wait = (time = 1000) =>
  new Promise(_ => setTimeout(_, time))

export class AppRoot extends LitElement {

  static properties = {
    profile: { state: true, type: Object },
    aliases: { state: true, type: Object },
    credentials: { state: true, type: Object },
  }
  static styles = css`
      table, th, td {
        padding: 8px;
        border-width: 1px;
        border-style: solid;
        border-collapse: collapse;
        border-color: rgb(128, 128, 128);
      }

      output {
        opacity: .5;
        font-size: .8em;
      }
    `
  refs = {
    auth: createRef(),
    alias: createRef(),
    seasonRating: createRef(),
    overallRating: createRef(),
    seasonRatingImage: createRef(),
    overallRatingImage: createRef(),
  }
  chains = {
    alias: {
      promise: Promise.resolve(),
      controller: new AbortController(),
    },
  }

  static getStorageItem(key) {
    try {
      const json = localStorage.getItem(key)
      if (json) return JSON.parse(json)
    } catch (error) {
      console.error(error)
    }
  }

  static setStorageItem(key, value) {
    if (
      value === null ||
      typeof value === 'undefined'
    )
      localStorage.removeItem(key)
    else {
      const json = JSON.stringify(value)
      localStorage.setItem(key, json)
    }
    return value
  }

  async connectedCallback() {
    const {
      getStorageItem,
    } = this.constructor
    await super.connectedCallback()
    this.profile = getStorageItem('profile')
    this.aliases = getStorageItem('aliases')
    this.credentials = getStorageItem('credentials')
    if (this.credentials) {
      await this.checkAuth()
      await this.getAliases()
    }
  }

  render() {
    return when(
      typeof this.profile === 'object',
      this.renderProfile.bind(this),
      this.renderAuth.bind(this),
    )
  }

  renderAuth() {
    const { auth } = this.refs
    return html`
            <form @submit="${this.submitAuth}">
                <h1>Авторизация</h1>
                <p>
                    <label for="login">
                        Логин:
                        <input id="login" name="login" type="text" required>
                    </label>
                </p>
                <p>
                    <label for="password">
                        Пароль:
                        <input id="password" name="password" type="password" required>
                    </label>
                </p>
                <p>
                    <button type="submit">Войти</button>
                    <output ${ref(auth)}></output>
                </p>
            </form>
        `
  }

  renderProfile() {
    const {
      seasonRating,
      overallRating,
      seasonRatingImage,
      overallRatingImage,
    } = this.refs
    const { city } = this.profile
    return html`
            <h1>${city}</h1>
            <button @click="${this.logout}">Сменить аккаунт</button>
            <h2>Создание рейтинга</h2>
            <p>
                <button @click="${this.createRating.bind(this, 'overall', overallRating)}">Общий рейтинг</button>
                <output ${ref(overallRating)}></output>
            </p>
            <p>
                <button @click="${this.createRating.bind(this, 'season', seasonRating)}">Сезонный рейтинг</button>
                <output ${ref(seasonRating)}></output>
            </p>
            <h2>Создание обложки</h2>
            <p>
                <label for="pdf">
                    <input type="checkbox" ?checked="${this.pdf}" id="pdf" @change="${this.setPDF}">
                    В формате SVG
                </label>
            </p>
            <p>
                <button @click="${this.createRatingImage.bind(this, 'overall', overallRatingImage)}">
                    Общий рейтинг
                </button>
                <output ${ref(overallRatingImage)}></output>
            </p>
            <p>
                <button @click="${this.createRatingImage.bind(this, 'season', seasonRatingImage)}">
                    Сезонный рейтинг
                </button>
                <output ${ref(seasonRatingImage)}></output>
            </p>
            <h2>Команды</h2>
            ${when(
      this.aliases,
      this.renderAliases.bind(this),
      () => html`<p>Загрузка алиасов...</p>`,
    )}
        `
  }

  renderAliases() {
    const { alias } = this.refs
    return html`
            <h3>Объединить команды</h3>
            <form @submit="${this.createAlias}">
                <p>
                    <label for="alias">
                        Название из таблицы:
                        <input id="alias" name="alias" type="text" required>
                    </label>
                </p>
                <p>
                    <label for="team">
                        Название в рейтинг:
                        <input id="team" name="team" type="text" required>
                    </label>
                </p>
                <p>
                    <button>Добавить</button>
                    <output ${ref(alias)}></output>
                </p>
            </form>
            <h3>Объединенные команды</h3>
            ${when(
      Object.keys(this.aliases).length,
      () => html`
                        <table>
                            <thead>
                            <tr>
                                <th>Из таблицы</th>
                                <th>В рейтинг</th>
                                <th>Действие</th>
                            </tr>
                            </thead>
                            <tbody>
                            ${map(
        Object.entries(this.aliases),
        ([alias, team] = []) => html`
                                        <tr>
                                            <td>${alias}</td>
                                            <td>${team}</td>
                                            <td>
                                                <button @click="${this.deleteAlias.bind(this, alias)}">Удалить</button>
                                            </td>
                                        </tr>
                                    `,
      )}
                            </tbody>
                        </table>
                    `,
      () => html`<p>Список команд пуст</p>`,
    )}
        `
  }

  async submitAuth(event) {
    const {
      setStorageItem,
    } = this.constructor
    const {
      auth: {
        value: output,
      } = {},
    } = this.refs
    try {
      event.preventDefault()
      const data = new FormData(event.currentTarget)
      this.credentials = Object.fromEntries(data.entries())
      setStorageItem('credentials', this.credentials)
      output.innerText = 'Авторизация...'
      if (await this.checkAuth())
        await this.getAliases()
    } catch (error) {
      console.error(error)
      output.innerText = error.message
    }
  }

  async createAlias(event) {
    let resolve
    const {
      currentTarget: form,
    } = event
    const {
      alias: {
        value: output,
      } = {},
    } = this.refs
    try {
      event.preventDefault()
      const data = new FormData(form)
      const payload = Object.fromEntries(data.entries())
      const { alias, team } = payload
      output.innerText = 'Добавление...'
      this.aliases = { ...this.aliases, [alias]: team }
      form.reset()
      resolve = await this.chain('alias')
      const response = await this.fetchAPI('aliases/create', payload)
      const { ok } = await response.json()
      output.innerText = 'Готово'
      void this.getAliases()
    } catch (error) {
      console.error(error)
      output.innerText = error.message
    } finally {
      resolve()
    }
  }

  async deleteAlias(alias) {
    let resolve
    try {
      this.aliases = Object.fromEntries(Object.entries(this.aliases).filter(([a]) => a !== alias))
      resolve = await this.chain('alias')
      const response = await this.fetchAPI('aliases/delete', { alias })
      const { ok } = await response.json()
      void this.getAliases()
    } catch (error) {
      console.error(error)
      alert(error.message)
    } finally {
      resolve()
    }
  }

  async createRating(type, { value: output } = {}) {
    try {
      output.innerText = 'Создание...'
      const response = await this.fetchAPI('rating', { type })
      const {
        ok,
        error: {
          message,
        } = {},
      } = await response.json()
      output.innerText = ok ? 'Готово' : message
    } catch (error) {
      console.error(error)
      output.innerText = error.message
    }
  }

  async createRatingImage(type, { value: output } = {}) {
    try {
      let file
      output.innerText = 'Создание...'
      const dataResponse = await this.fetchAPI('get', { type })
      const {
        ok,
        error: {
          message,
        } = {},
        result: data = [],
      } = await dataResponse.json()
      const format = this.pdf ? 'svg' : 'png'
      // const extension = this.pdf ? "pdf" : "png";
      if (!ok) return output.innerText = message
      const subtitle = type === 'season' ? 'сезонный' : 'общий'
      const payload = { data, type, subtitle, simple: this.pdf }
      const imageResponse = await this.fetchAPI(`image/${format}`, payload)
      if (!imageResponse.ok) return output.innerText = 'Ошибка'
      /* if (this.pdf) {
          const width = 900;
          const height = (23 * (data.length - 1)) + 41 + 50;
          const url = new URL("/api/image/pdf", location);
          url.searchParams.set("height", String(height));
          url.searchParams.set("width", String(width));
          const body = await imageResponse.blob();
          const headers = {"Content-type": "text/plain"};
          const pdfResponse = await fetch(url, {body, headers, method: "POST"});
          if (!pdfResponse.ok) return output.innerText = "Ошибка";
          file = await pdfResponse.blob();
      } else */
      file = await imageResponse.blob()
      output.innerText = 'Загрузка...'
      FileSaver.saveAs(file, `rating.${format}`)
      output.innerText = 'Готово'
    } catch (error) {
      console.error(error)
      output.innerText = error.message
    }
  }

  async checkAuth() {
    const {
      setStorageItem,
    } = this.constructor
    const response = await this.fetchAPI()
    const result = await response.json()
    const { error } = result || {}
    if (!response.ok || error) {
      const {
        message = 'Произошла ошибка',
      } = error || {}
      setStorageItem('credentials')
      setStorageItem('profile')
      throw new Error(message)
    }
    return setStorageItem('profile', this.profile = result)
  }

  async getAliases() {
    const {
      setStorageItem,
    } = this.constructor
    const resolve = await this.chain('alias')
    const response = await this.fetchAPI('aliases')
    const result = await response.json()
    const { error } = result || {}
    resolve()
    if (!response.ok || error) {
      const {
        message = 'Произошла ошибка',
      } = error || {}
      setStorageItem('aliases')
      throw new Error(message)
    }
    return setStorageItem('aliases', this.aliases = result)
  }

  async waitForOperation({ href } = {}) {
    try {
      let status
      const id = href.split('/').pop()
      do {
        await wait(1000)
        const response = await this.fetchAPI('operation', { id });
        ({ status } = await response.json())
      } while (status === 'in-progress')
    } catch (e) {
      console.error(e)
    }
  }

  fetchAPI(method = 'auth', payload = {}) {
    const {
      login,
      password,
    } = this.credentials || {}
    const json = {
      login,
      password,
      ...payload,
    }
    const init = {
      method: 'POST',
      body: JSON.stringify(json),
      headers: {
        'Content-Type': 'application/json',
      },
    }
    const path = ['', 'api', method].join('/')
    const url = new URL(path, 'https://shakerquiz-rating-5c3a.twc1.net')
    console.debug(url.href, json)
    return fetch(url, init)
  }

  logout() {
    this.constructor.setStorageItem('aliases', this.aliases = undefined)
    this.constructor.setStorageItem('profile', this.profile = undefined)
    this.constructor.setStorageItem('credentials', this.credentials = undefined)
  }

  setPDF({ currentTarget: { checked } = {} } = {}) {
    return this.pdf = Boolean(checked)
  }

  chain(id, abort) {
    let callback
    const chain = this.chains[id] ??= {
      controller: new AbortController(),
      promise: Promise.resolve(),
    }
    const controller = new AbortController()
    const promise = chain.promise.catch(console.error)
    const next = new Promise((resolve, reject) => {
      controller.signal.addEventListener('abort', reject)
      callback = resolve
    })
    chain.promise = promise.then(() => next)
    if (abort) chain.controller.abort()
    chain.controller = controller
    return promise.then(() => callback)
  }

}

customElements.define('app-root', AppRoot)
