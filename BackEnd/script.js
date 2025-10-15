// ================= CONFIGURAÇÃO DA API ==================
const API_URL = 'http://127.0.0.1:8001';
let token = localStorage.getItem('token');

// apiRequest agora retorna um objeto { ok, status, data }
// data será o JSON parseado (ou null)
async function apiRequest(endpoint, options = {}) {
    try {
        const headers = {
            ...options.headers
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const resp = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers
        });

        console.log(`API Request: ${endpoint}`, resp.status);

        if (resp.status === 401) {
            token = null;
            localStorage.removeItem('token');
            // notifica UI de logout
            return { ok: false, status: 401, data: null };
        }

        let data = null;
        const ct = resp.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
            data = await resp.json();
        } else {
            try { data = await resp.text(); } catch(e) { data = null; }
        }

        return { ok: resp.ok, status: resp.status, data };
    } catch (error) {
        console.error(`Erro na requisição ${endpoint}:`, error);
        return { ok: false, status: 0, data: null };
    }
}

// ================= LOGIN + PERMISSÕES ==================

// Elementos do login
const botaoEntrar = document.getElementById("botao-entrar");
const campoUsuario = document.getElementById("campo-usuario");
const campoSenha = document.getElementById("campo-senha");

// Elementos do cadastro
const modalCadastro = document.getElementById('modal-cadastro');
const formCadastro = document.getElementById('form-cadastro');
const botaoCadastro = document.getElementById('botao-cadastro');
const fecharCadastro = document.getElementById('fechar-cadastro');
const mensagemCadastro = document.getElementById('mensagem-cadastro');

// Funções de Cadastro
async function cadastrarUsuario(dados) {
    const response = await apiRequest('/cadastro', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dados)
    });
    
    return response;
}

// Event Listeners do Cadastro
botaoCadastro?.addEventListener('click', () => {
    modalCadastro.classList.remove('oculto');
});

fecharCadastro?.addEventListener('click', () => {
    modalCadastro.classList.add('oculto');
    formCadastro.reset();
    mensagemCadastro.textContent = '';
});

formCadastro?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const senha = document.getElementById('cadastro-senha').value;
    const confirmaSenha = document.getElementById('cadastro-confirma-senha').value;
    
    if (senha !== confirmaSenha) {
        mensagemCadastro.textContent = 'As senhas não coincidem!';
        mensagemCadastro.style.color = '#f44336';
        return;
    }
    
    const dados = {
        username: document.getElementById('cadastro-usuario').value,
        nome: document.getElementById('cadastro-nome').value,
        email: document.getElementById('cadastro-email').value,
        cargo: document.getElementById('cadastro-cargo').value,
        senha: senha
    };
    
    try {
        const result = await cadastrarUsuario(dados);
        
        if (result.ok) {
            mensagemCadastro.textContent = 'Cadastro realizado com sucesso!';
            mensagemCadastro.style.color = '#4CAF50';
            setTimeout(() => {
                modalCadastro.classList.add('oculto');
                formCadastro.reset();
                mensagemCadastro.textContent = '';
            }, 2000);
        } else {
            mensagemCadastro.textContent = result.data?.detail || 'Erro ao cadastrar usuário';
            mensagemCadastro.style.color = '#f44336';
        }
    } catch (error) {
        console.error('Erro ao cadastrar:', error);
        mensagemCadastro.textContent = 'Erro ao conectar com o servidor';
        mensagemCadastro.style.color = '#f44336';
    }
});
const mensagemLogin = document.getElementById("mensagem-login");

const menuLogin = document.getElementById("id-login");
const menuPosLogin = document.getElementById("menu-pos-login");

const nomeUsuario = document.getElementById("usuario-nome");
const cargoUsuario = document.getElementById("usuario-cargo");

// Usuários e papéis (somente para demo/local)
const usuarios = {
  funcionario: { senha: "1234", cargo: "Funcionário", role: "funcionario" },
  gerente: { senha: "4321", cargo: "Gerente", role: "gerente" },
  admin: { senha: "batman", cargo: "Administrador de Segurança", role: "admin" },
};

// Permissões por cargo
const permissions = {
  funcionario: {
    view_dashboard: true,
    adicionar_recurso: false,
    remover_recurso: false,
    adicionar_incidente: true,
    remover_incidente: false,
    ver_relatorios: true,
  },
  gerente: {
    view_dashboard: true,
    adicionar_recurso: true,
    remover_recurso: true,
    adicionar_incidente: true,
    remover_incidente: true,
    ver_relatorios: true,
  },
  admin: {
    view_dashboard: true,
    adicionar_recurso: true,
    remover_recurso: true,
    adicionar_incidente: true,
    remover_incidente: true,
    ver_relatorios: true,
    administrar_usuarios: true,
  },
};

let currentUser = null;

// Função helper
function hasPermission(perm) {
  if (!currentUser) return false;
  const role = currentUser.role;
  return permissions[role] && permissions[role][perm];
}

// Login (usa application/x-www-form-urlencoded para OAuth2)
botaoEntrar.addEventListener("click", async (e) => {
    e.preventDefault();
    const usuario = campoUsuario.value.trim();
    const senha = campoSenha.value.trim();

    if (!usuario || !senha) {
      mensagemLogin.textContent = "Digite usuário e senha.";
      return;
    }

    try {
        const body = new URLSearchParams();
        body.append('username', usuario);
        body.append('password', senha);

        const resp = await fetch(`${API_URL}/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body.toString()
        });

        const data = await (resp.headers.get('content-type') || '').includes('application/json') ? await resp.json() : null;

        if (resp.ok && data && data.access_token) {
            token = data.access_token;
            localStorage.setItem('token', token);

            currentUser = {
                username: usuario,
                role: usuarios[usuario]?.role || 'funcionario'
            };

            menuLogin.classList.add("oculto");
            menuPosLogin.classList.remove("oculto");
            document.getElementById("tela-dashboard").classList.remove("oculto");

            nomeUsuario.textContent = currentUser.username;
            cargoUsuario.textContent = usuarios[usuario]?.cargo || '';

            // Carrega dados iniciais
            await Promise.all([
                carregarRecursos(),
                carregarIncidentes(),
                atualizarDashboard()
            ]);
        } else {
            mensagemLogin.textContent = "Usuário ou senha inválidos!";
        }
    } catch (error) {
        console.error('Erro no login:', error);
        mensagemLogin.textContent = "Erro ao conectar com o servidor!";
    }
});

// Sair
const botaoSair = document.getElementById("botao-sair");
botaoSair.addEventListener("click", () => {
  menuLogin.classList.remove("oculto");
  menuPosLogin.classList.add("oculto");
  campoUsuario.value = "";
  campoSenha.value = "";
  currentUser = null;
  token = null;
  localStorage.removeItem('token');
  aplicarPermissoesNaUI();
});

// Função para aplicar permissões na interface
function aplicarPermissoesNaUI() {
  const botaoAdicionarRecurso = document.getElementById("botao-adicionar-recurso");
  const botaoAdicionarIncidente = document.getElementById("botao-adicionar-incidente");
  const botoesRemoverRecurso = document.querySelectorAll(".btn-remover-recurso");
  const botoesRemoverIncidente = document.querySelectorAll(".btn-remover-incidente");
  const navRelatorios = document.getElementById("relatorios");

  if (botaoAdicionarRecurso)
    botaoAdicionarRecurso.style.display = hasPermission("adicionar_recurso") ? "" : "none";

  if (botaoAdicionarIncidente)
    botaoAdicionarIncidente.style.display = hasPermission("adicionar_incidente") ? "" : "none";

  botoesRemoverRecurso.forEach((btn) =>
    btn.style.display = hasPermission("remover_recurso") ? "" : "none"
  );

  botoesRemoverIncidente.forEach((btn) =>
    btn.style.display = hasPermission("remover_incidente") ? "" : "none"
  );

  if (navRelatorios)
    navRelatorios.style.display = hasPermission("ver_relatorios") ? "" : "none";
}

// ================= NAVEGAÇÃO ENTRE TELAS =================

const botoesNavegacao = document.querySelectorAll(".nav-btn");
const telas = document.querySelectorAll(".tela");

botoesNavegacao.forEach((botao) => {
  botao.addEventListener("click", () => {
    botoesNavegacao.forEach((b) => b.classList.remove("ativo"));
    botao.classList.add("ativo");

    telas.forEach((tela) => tela.classList.add("oculto"));
    const idTela = "tela-" + botao.id;
    const telaAlvo = document.getElementById(idTela);
    if (telaAlvo) telaAlvo.classList.remove("oculto");
  });
});

// ================= DASHBOARD =================

let graficoAtividade;
const ctx = document.getElementById("grafico-atividade");
if (ctx) {
  graficoAtividade = new Chart(ctx, {
    type: "line",
    data: {
      labels: ["Recursos", "Inc. Ativos", "Inc. Resolvidos", "Câmeras Ativas"],
      datasets: [
        {
          label: "Status Atual",
          data: [0, 0, 0, 0],
          borderColor: "#cbbd77",
          backgroundColor: "rgba(203, 189, 119, 0.1)",
          tension: 0.3,
        },
      ],
    },
    options: {
      scales: {
        y: { beginAtZero: true }
      },
      animation: {
        duration: 1000
      }
    },
  });
}

function atualizarGrafico() {
  if (!graficoAtividade) return;

  const totalRecursos = recursos.length;
  const incidentesAtivos = incidentes.filter(i => i.status !== "Resolvido").length;
  const incidentesResolvidos = incidentes.filter(i => i.status === "Resolvido").length;
  const camerasAtivas = recursos.filter(r => r.tipo === "Dispositivo" && r.status.toLowerCase() === "ativo").length;

  graficoAtividade.data.datasets[0].data = [
    totalRecursos,
    incidentesAtivos,
    incidentesResolvidos,
    camerasAtivas
  ];

  graficoAtividade.update();
}

// ================= CÍRCULO DE CÂMERAS E STATUS =================

const progresso = document.getElementById("progresso-camera");
const porcentagem = document.getElementById("porcentagem-camera");
const estadoSeguranca = document.getElementById("estado-seguranca");

function atualizarUsoCameras() {
  // strokeDasharray correspondente ao perímetro do círculo (r = 62 -> ~389)
  if (!progresso) return;
  const total = recursos.filter(r => r.tipo === "Dispositivo").length || 0;
  const ativas = recursos.filter(r => r.tipo === "Dispositivo" && r.status.toLowerCase() === "ativo").length || 0;
  const percentual = total === 0 ? 0 : Math.round((ativas / total) * 100);
  porcentagem.textContent = percentual;
  const dasharray = 389;
  const dashoffset = Math.round(dasharray - (dasharray * percentual) / 100);
  progresso.style.strokeDasharray = `${dasharray}`;
  progresso.style.strokeDashoffset = `${dashoffset}`;
}

// atualizarDashboard faz chamada ao backend para estatísticas
async function atualizarDashboard() {
  const resp = await apiRequest('/dashboard/stats', { method: 'GET' });
  if (resp && resp.ok && resp.data) {
    const stats = resp.data;
    estadoSeguranca.textContent = stats.status_sistema;
    estadoSeguranca.className = `estado estado-${stats.status_sistema.toLowerCase()}`;

    const percentual = Math.round((stats.cameras_ativas / (stats.total_recursos || 1)) * 100) || 0;
    porcentagem.textContent = percentual;
    const dasharray = 389;
    const dashoffset = Math.round(dasharray - (dasharray * percentual) / 100);
    progresso.style.strokeDasharray = `${dasharray}`;
    progresso.style.strokeDashoffset = `${dashoffset}`;

    if (graficoAtividade) {
      graficoAtividade.data.datasets[0].data = [
        stats.total_recursos,
        stats.incidentes_abertos,
        stats.incidentes_resolvidos,
        stats.cameras_ativas
      ];
      graficoAtividade.update();
    }
  } else {
    console.warn('Não foi possível atualizar dashboard (resposta nula).');
  }
}

function atualizarStatusSeguranca() {
  const incidentesCriticos = incidentes.filter(i => i.gravidade === "Crítica" && i.status !== "Resolvido");
  const incidentesAlta = incidentes.filter(i => i.gravidade === "Alta" && i.status !== "Resolvido");

  if (incidentesCriticos.length > 0) {
    estadoSeguranca.textContent = "CRÍTICO";
    estadoSeguranca.className = "estado estado-critico";
  } else if (incidentesAlta.length > 0) {
    estadoSeguranca.textContent = "ALERTA";
    estadoSeguranca.className = "estado estado-alerta";
  } else {
    estadoSeguranca.textContent = "NORMAL";
    estadoSeguranca.className = "estado estado-normal";
  }
}

// ================= GESTÃO DE RECURSOS =================

const listaRecursos = document.getElementById("lista-recursos");
const botaoAdicionar = document.getElementById("botao-adicionar-recurso");
const modal = document.getElementById("modal-recurso");
const cancelar = document.getElementById("cancelar-recurso");
const salvar = document.getElementById("salvar-recurso");
const fecharModal = document.getElementById("fechar-modal");

const tipoRecurso = document.getElementById("tipo-recurso");
const nomeRecurso = document.getElementById("nome-recurso");
const statusRecurso = document.getElementById("status-recurso");
const localizacaoRecurso = document.getElementById("localizacao-recurso");

let recursos = [];

function fecharModalRecurso() {
  modal.classList.add("oculto");
  limparCamposRecurso();
}

botaoAdicionar.addEventListener("click", () => {
  if (!hasPermission("adicionar_recurso")) return alert("Você não tem permissão.");
  modal.classList.remove("oculto");
});

cancelar.addEventListener("click", fecharModalRecurso);
fecharModal.addEventListener("click", fecharModalRecurso);

salvar.addEventListener("click", async () => {
    if (!hasPermission("adicionar_recurso")) return alert("Você não tem permissão.");
    if (!nomeRecurso.value) return alert("Digite um nome para o recurso!");

    const novoRecurso = {
        tipo: tipoRecurso.value,
        nome: nomeRecurso.value,
        status: statusRecurso.value,
        localizacao: localizacaoRecurso.value,
    };

    try {
        const response = await apiRequest('/recursos/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(novoRecurso)
        });

        if (response && response.ok && response.data) {
            await carregarRecursos();
            fecharModalRecurso();
            atualizarDashboard();
        } else {
            alert('Erro ao salvar recurso (ver console).');
        }
    } catch (error) {
        console.error('Erro ao salvar recurso:', error);
        alert('Erro ao salvar recurso');
    }
});

function atualizarTabelaRecursos() {
  listaRecursos.innerHTML = "";
  recursos.forEach((r) => {
    const linha = document.createElement("tr");
    linha.innerHTML = `
      <td>${r.tipo}</td>
      <td>${r.nome}</td>
      <td>${r.status}</td>
      <td>${r.localizacao || ''}</td>
      <td>
        <button class="btn-remover-recurso" data-id="${r.id}">Remover</button>
      </td>
    `;
    listaRecursos.appendChild(linha);
  });

  // delegação para remover recurso via API
  document.querySelectorAll(".btn-remover-recurso").forEach(btn => {
    btn.style.display = hasPermission("remover_recurso") ? "" : "none";
    btn.addEventListener("click", async (ev) => {
      const id = ev.currentTarget.getAttribute("data-id");
      if (!id) return;
      if (!confirm("Remover recurso?")) return;
      const resp = await apiRequest(`/recursos/${id}`, { method: 'DELETE' });
      if (resp && resp.ok) {
        await carregarRecursos();
        atualizarRelatorios();
        atualizarGrafico();
        atualizarUsoCameras();
      } else {
        alert('Erro ao remover recurso.');
      }
    });
  });

  aplicarPermissoesNaUI();
  atualizarUsoCameras();
}

function limparCamposRecurso() {
  nomeRecurso.value = "";
  statusRecurso.value = "";
  localizacaoRecurso.value = "";
}

// ================= INCIDENTES =================

let incidentes = [];

const botaoAdicionarIncidente = document.getElementById("botao-adicionar-incidente");
const modalIncidente = document.getElementById("modal-incidente");
const salvarIncidente = document.getElementById("salvar-incidente");
const cancelarIncidente = document.getElementById("cancelar-incidente");
const fecharModalIncidente = document.getElementById("fechar-modal-incidente");
const listaTabelaIncidentes = document.getElementById("lista-incidentes");

function limparCamposIncidente() {
  document.getElementById("titulo-incidente").value = "";
  document.getElementById("gravidade-incidente").value = "Baixa";
  document.getElementById("status-incidente").value = "Aberto";
}

function fecharModalIncidentes() {
  modalIncidente.classList.add("oculto");
  limparCamposIncidente();
}

botaoAdicionarIncidente.addEventListener("click", () => {
  if (!hasPermission("adicionar_incidente")) return alert("Você não tem permissão.");
  modalIncidente.classList.remove("oculto");
});

cancelarIncidente.addEventListener("click", fecharModalIncidentes);
fecharModalIncidente.addEventListener("click", fecharModalIncidentes);

salvarIncidente.addEventListener("click", async () => {
    if (!hasPermission("adicionar_incidente")) return alert("Você não tem permissão.");

    const novoIncidente = {
        titulo: document.getElementById("titulo-incidente").value,
        gravidade: document.getElementById("gravidade-incidente").value,
        status: document.getElementById("status-incidente").value
    };

    if (!novoIncidente.titulo) return alert("Digite o título do incidente!");

    try {
        const response = await apiRequest('/incidentes/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(novoIncidente)
        });

        if (response && response.ok && response.data) {
            await carregarIncidentes();
            fecharModalIncidentes();
            atualizarDashboard();
        } else {
            alert('Erro ao salvar incidente (ver console).');
        }
    } catch (error) {
        console.error('Erro ao salvar incidente:', error);
        alert('Erro ao salvar incidente');
    }
});

function atualizarTabelaIncidentes() {
  listaTabelaIncidentes.innerHTML = "";
  incidentes.forEach((i) => {
    const linha = document.createElement("tr");
    linha.innerHTML = `
      <td>${i.titulo}</td>
      <td>${i.gravidade}</td>
      <td>${i.status}</td>
      <td><button class="btn-remover-incidente" data-id="${i.id}">Remover</button></td>
    `;
    listaTabelaIncidentes.appendChild(linha);
  });

  document.querySelectorAll(".btn-remover-incidente").forEach(btn => {
    btn.style.display = hasPermission("remover_incidente") ? "" : "none";
    btn.addEventListener("click", async (ev) => {
      const id = ev.currentTarget.getAttribute("data-id");
      if (!id) return;
      if (!confirm("Remover incidente?")) return;
      const resp = await apiRequest(`/incidentes/${id}`, { method: 'DELETE' });
      if (resp && resp.ok) {
        await carregarIncidentes();
        atualizarRelatorios();
        atualizarStatusSeguranca();
        atualizarGrafico();
      } else {
        alert('Erro ao remover incidente.');
      }
    });
  });

  aplicarPermissoesNaUI();
  atualizarStatusSeguranca();
}

// ================= RELATÓRIOS =================

function atualizarRelatorios() {
  const recCount = document.getElementById("relatorio-recursos");
  const incCount = document.getElementById("relatorio-incidentes");

  if (recCount) recCount.textContent = recursos.length;
  if (incCount) incCount.textContent = incidentes.length;
}

// ================= FUNÇÕES DE CARREGAMENTO =================

async function carregarRecursos() {
  const resp = await apiRequest('/recursos/', { method: 'GET' });
  if (resp && resp.ok && Array.isArray(resp.data)) {
    recursos = resp.data.map(r => ({ id: r.id, tipo: r.tipo, nome: r.nome, status: r.status, localizacao: r.localizacao }));
    atualizarTabelaRecursos();
    atualizarRelatorios();
    atualizarGrafico();
    atualizarUsoCameras();
  } else {
    recursos = [];
    atualizarTabelaRecursos();
    atualizarRelatorios();
  }
}

async function carregarIncidentes() {
  const resp = await apiRequest('/incidentes/', { method: 'GET' });
  if (resp && resp.ok && Array.isArray(resp.data)) {
    incidentes = resp.data.map(i => ({ id: i.id, titulo: i.titulo, gravidade: i.gravidade, status: i.status }));
    atualizarTabelaIncidentes();
    atualizarRelatorios();
    atualizarStatusSeguranca();
    atualizarGrafico();
  } else {
    incidentes = [];
    atualizarTabelaIncidentes();
    atualizarRelatorios();
  }
}

// ================= INICIALIZAÇÃO =================

atualizarUsoCameras();
atualizarStatusSeguranca();
aplicarPermissoesNaUI();

// Se já houver token salvo, tenta carregar dados (não tenta relogar automaticamente)
if (token) {
  (async () => {
    await carregarRecursos();
    await carregarIncidentes();
    await atualizarDashboard();
  })();
}
