// ================= CONFIGURAÇÃO DA API ==================
const API_URL = 'http://127.0.0.1:8001';
let token = localStorage.getItem('token');

// Atualiza função apiRequest para lidar melhor com erros
async function apiRequest(endpoint, options = {}) {
    try {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers
        });

        // Log para debug
        console.log(`API Request: ${endpoint}`, response.status);

        if (response.status === 401) {
            token = null;
            localStorage.removeItem('token');
            window.location.reload();
            return null;
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`Erro na requisição ${endpoint}:`, error);
        return null;
    }
}

// ================= LOGIN + PERMISSÕES ==================

const botaoEntrar = document.getElementById("botao-entrar");
const campoUsuario = document.getElementById("campo-usuario");
const campoSenha = document.getElementById("campo-senha");
const mensagemLogin = document.getElementById("mensagem-login");

const menuLogin = document.getElementById("id-login");
const menuPosLogin = document.getElementById("menu-pos-login");

const nomeUsuario = document.getElementById("usuario-nome");
const cargoUsuario = document.getElementById("usuario-cargo");

// Usuários e papéis
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

// Login
botaoEntrar.addEventListener("click", async (e) => {
    e.preventDefault();
    const usuario = campoUsuario.value.trim();
    const senha = campoSenha.value.trim();

    try {
        const formData = new FormData();
        formData.append('username', usuario);
        formData.append('password', senha);

        const response = await fetch(`${API_URL}/token`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            token = data.access_token;
            localStorage.setItem('token', token);
            
            // Atualiza usuário atual
            currentUser = {
                username: usuario,
                role: usuarios[usuario]?.role || 'funcionario'
            };

            menuLogin.classList.add("oculto");
            menuPosLogin.classList.remove("oculto");
            document.getElementById("tela-dashboard").classList.remove("oculto");

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

async function atualizarDashboard() {
  const stats = await apiRequest('/dashboard/stats');
  if (stats) {
    // Atualiza status do sistema
    estadoSeguranca.textContent = stats.status_sistema;
    estadoSeguranca.className = `estado estado-${stats.status_sistema.toLowerCase()}`;
    
    // Atualiza uso de câmeras
    const percentual = Math.round((stats.cameras_ativas / stats.total_cameras) * 100) || 0;
    porcentagem.textContent = percentual;
    const dashoffset = 389 - (389 * percentual) / 100;
    progresso.style.strokeDashoffset = dashoffset;
    
    // Atualiza gráfico
    if (graficoAtividade) {
        graficoAtividade.data.datasets[0].data = [
          stats.total_recursos,
          stats.incidentes_abertos,
          stats.incidentes_resolvidos,
          stats.cameras_ativas
        ];
        graficoAtividade.update();
      }
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
            body: JSON.stringify(novoRecurso)
        });

        if (response.ok) {
            await carregarRecursos();
            fecharModalRecurso();
            atualizarDashboard();
        }
    } catch (error) {
        console.error('Erro ao salvar recurso:', error);
        alert('Erro ao salvar recurso');
    }
});

function atualizarTabelaRecursos() {
  listaRecursos.innerHTML = "";
  recursos.forEach((r, index) => {
    const linha = document.createElement("tr");
    linha.innerHTML = `
      <td>${r.tipo}</td>
      <td>${r.nome}</td>
      <td>${r.status}</td>
      <td>${r.localizacao}</td>
      <td><button class="btn-remover-recurso" onclick="removerRecurso(${index})">Remover</button></td>
    `;
    listaRecursos.appendChild(linha);
  });
  aplicarPermissoesNaUI();
  atualizarUsoCameras();
}

function removerRecurso(index) {
  if (!hasPermission("remover_recurso")) return alert("Você não tem permissão.");
  recursos.splice(index, 1);
  atualizarTabelaRecursos();
  atualizarRelatorios();
  atualizarGrafico();
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
            body: JSON.stringify(novoIncidente)
        });

        if (response.ok) {
            await carregarIncidentes();
            fecharModalIncidentes();
            atualizarDashboard();
        }
    } catch (error) {
        console.error('Erro ao salvar incidente:', error);
        alert('Erro ao salvar incidente');
    }
});

function atualizarTabelaIncidentes() {
  listaTabelaIncidentes.innerHTML = "";
  incidentes.forEach((i, index) => {
    const linha = document.createElement("tr");
    linha.innerHTML = `
      <td>${i.titulo}</td>
      <td>${i.gravidade}</td>
      <td>${i.status}</td>
      <td><button class="btn-remover-incidente" onclick="removerIncidente(${index})">Remover</button></td>
    `;
    listaTabelaIncidentes.appendChild(linha);
  });
  aplicarPermissoesNaUI();
  atualizarStatusSeguranca();
}

function removerIncidente(index) {
  if (!hasPermission("remover_incidente")) return alert("Você não tem permissão.");
  incidentes.splice(index, 1);
  atualizarTabelaIncidentes();
  atualizarRelatorios();
  atualizarStatusSeguranca();
  atualizarGrafico();
}

// ================= RELATÓRIOS =================

function atualizarRelatorios() {
  const recCount = document.getElementById("relatorio-recursos");
  const incCount = document.getElementById("relatorio-incidentes");

  if (recCount) recCount.textContent = recursos.length;
  if (incCount) incCount.textContent = incidentes.length;
}

// ================= INICIALIZAÇÃO =================

atualizarUsoCameras();
atualizarStatusSeguranca();
