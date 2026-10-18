import { describe, expect, it } from 'vitest';
import {
  DEFINICION_MOTOR,
  archivoSqlite,
  enmascararUrl,
  motorDeUrl,
} from '@/lib/basedatos/motores';
import { construirUrl, esRutaAbsoluta, parsearUrl } from '@/lib/basedatos/conexion';
import { identificador, literalSql, sentenciaInsert, sentenciasBorrado } from '@/lib/basedatos/sql';
import {
  sentenciasInsert,
  volcadoAJson,
  volcadoDesdeJson,
  type DatosVolcadoJson,
} from '@/lib/basedatos/volcado';
import { TABLAS, type DefinicionTabla } from '@/lib/basedatos/catalogo';
import { esTablaConservada, filtroVaciar, tablasQueSeVacian } from '@/lib/basedatos/limpieza';
import { esquemaConProveedor, proveedorDelEsquema } from '@/lib/basedatos/prisma-cli';
import { esquemaConexion, esquemaRespaldo } from '@/lib/esquemas/base-datos';
import {
  CORREO_ADMIN_POR_DEFECTO,
  LARGO_MINIMO_CONTRASENA,
  generarContrasena,
  resolverAdministradorInicial,
} from '@/lib/auth/administrador-inicial';

const ESQUEMA = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite" // en produccion: "postgresql"
  url      = env("DATABASE_URL")
}
`;

describe('motorDeUrl', () => {
  it('reconoce los tres motores', () => {
    expect(motorDeUrl('file:./dev.db')).toBe('sqlite');
    expect(motorDeUrl('postgresql://u:c@h:5432/db?schema=public')).toBe('postgresql');
    expect(motorDeUrl('postgres://u:c@h:5432/db')).toBe('postgresql');
    expect(motorDeUrl('mysql://u:c@h:3306/db')).toBe('mysql');
    expect(motorDeUrl('MYSQL://u:c@h/db')).toBe('mysql');
  });

  it('devuelve null cuando no se reconoce', () => {
    expect(motorDeUrl('sqlserver://h:1433/db')).toBeNull();
    expect(motorDeUrl('')).toBeNull();
    expect(motorDeUrl(undefined)).toBeNull();
  });
});

describe('enmascararUrl', () => {
  it('oculta la contrasena', () => {
    expect(enmascararUrl('postgresql://usuario:secreto@localhost:5432/db')).toBe(
      'postgresql://usuario:***@localhost:5432/db',
    );
  });

  it('deja intacto un archivo SQLite', () => {
    expect(enmascararUrl('file:./dev.db')).toBe('file:./dev.db');
    expect(archivoSqlite('file:./dev.db')).toBe('./dev.db');
  });

  it('funciona sin contrasena', () => {
    expect(enmascararUrl('mysql://root@localhost:3306/db')).toBe('mysql://root:***@localhost:3306/db');
  });
});

describe('construirUrl y parsearUrl', () => {
  it('arma la cadena de PostgreSQL', () => {
    expect(
      construirUrl({
        motor: 'postgresql',
        host: 'localhost',
        puerto: 5432,
        baseDatos: 'quizcolegio',
        usuario: 'admin',
        contrasena: 'clave',
      }),
    ).toBe('postgresql://admin:clave@localhost:5432/quizcolegio?schema=public');
  });

  it('agrega sslmode=require cuando se pide SSL', () => {
    const url = construirUrl({
      motor: 'postgresql',
      host: 'h',
      puerto: 5432,
      baseDatos: 'db',
      usuario: 'u',
      contrasena: 'c',
      ssl: true,
    });
    expect(url).toContain('sslmode=require');
  });

  it('arma la cadena de MySQL', () => {
    expect(
      construirUrl({
        motor: 'mysql',
        host: 'localhost',
        puerto: 3306,
        baseDatos: 'quizcolegio',
        usuario: 'root',
        contrasena: 'clave',
      }),
    ).toBe('mysql://root:clave@localhost:3306/quizcolegio');
  });

  it('escapa los caracteres especiales del usuario y la contrasena', () => {
    const url = construirUrl({
      motor: 'mysql',
      host: 'localhost',
      puerto: 3306,
      baseDatos: 'mi db',
      usuario: 'a@b',
      contrasena: 'p@ss:word',
    });
    expect(url).toBe('mysql://a%40b:p%40ss%3Aword@localhost:3306/mi%20db');
  });

  it('arma una ruta de SQLite con el prefijo file: y normaliza las barras', () => {
    expect(construirUrl({ motor: 'sqlite', archivo: './datos/quiz.db' })).toBe('file:./datos/quiz.db');
    expect(construirUrl({ motor: 'sqlite', archivo: 'file:./x.db' })).toBe('file:./x.db');
    expect(construirUrl({ motor: 'sqlite', archivo: 'C:\\datos\\quiz.db' })).toBe('file:C:/datos/quiz.db');
  });

  it('lee una cadena de conexion', () => {
    const config = parsearUrl(
      'postgresql',
      'postgresql://usuario:clave@servidor:5433/base?schema=public&sslmode=require',
    );
    expect(config).toEqual({
      motor: 'postgresql',
      host: 'servidor',
      puerto: 5433,
      baseDatos: 'base',
      usuario: 'usuario',
      contrasena: 'clave',
      ssl: true,
    });
  });
});

describe('esRutaAbsoluta', () => {
  it('acepta rutas absolutas de Windows, UNC y POSIX', () => {
    expect(esRutaAbsoluta('C:/datos/quiz.db')).toBe(true);
    expect(esRutaAbsoluta('C:\\datos\\quiz.db')).toBe(true);
    expect(esRutaAbsoluta('\\\\servidor\\recurso\\quiz.db')).toBe(true);
    expect(esRutaAbsoluta('/var/lib/quizcolegio.db')).toBe(true);
  });

  it('rechaza rutas relativas y vacias', () => {
    expect(esRutaAbsoluta('./datos/quiz.db')).toBe(false);
    expect(esRutaAbsoluta('datos/quiz.db')).toBe(false);
    expect(esRutaAbsoluta('')).toBe(false);
  });
});

describe('literalSql', () => {
  it('escapa las comillas simples', () => {
    expect(literalSql("O'Reilly", 'postgresql')).toBe("'O''Reilly'");
    expect(literalSql("O'Reilly", 'mysql')).toBe("'O''Reilly'");
    expect(literalSql("O'Reilly", 'sqlite')).toBe("'O''Reilly'");
  });

  it('escapa la barra invertida solo en MySQL', () => {
    expect(literalSql('a\\b', 'mysql')).toBe("'a\\\\b'");
    expect(literalSql('a\\b', 'postgresql')).toBe("'a\\b'");
    expect(literalSql('a\\b', 'sqlite')).toBe("'a\\b'");
  });

  it('elimina los bytes nulos', () => {
    expect(literalSql('a\u0000b', 'postgresql')).toBe("'ab'");
  });

  it('escribe los booleanos segun el motor', () => {
    expect(literalSql(true, 'postgresql')).toBe('TRUE');
    expect(literalSql(false, 'postgresql')).toBe('FALSE');
    expect(literalSql(true, 'mysql')).toBe('1');
    expect(literalSql(false, 'sqlite')).toBe('0');
  });

  it('escribe las fechas como milisegundos en SQLite y como texto UTC en el resto', () => {
    const fecha = new Date('2026-01-02T03:04:05.006Z');
    expect(literalSql(fecha, 'sqlite')).toBe(String(fecha.getTime()));
    expect(literalSql(fecha, 'postgresql')).toBe("'2026-01-02 03:04:05.006'");
    expect(literalSql(fecha, 'mysql')).toBe("'2026-01-02 03:04:05.006'");
  });

  it('escribe numeros y nulos', () => {
    expect(literalSql(1.5, 'postgresql')).toBe('1.5');
    expect(literalSql(-3, 'mysql')).toBe('-3');
    expect(literalSql(null, 'sqlite')).toBe('NULL');
    expect(literalSql(Number.NaN, 'sqlite')).toBe('NULL');
  });
});

describe('sentencias SQL', () => {
  const definicion: DefinicionTabla = {
    modelo: 'user',
    tabla: 'User',
    etiqueta: 'Usuarios',
    columnas: [
      { nombre: 'id', tipo: 'texto' },
      { nombre: 'active', tipo: 'booleano' },
    ],
  };

  it('cita los identificadores segun el motor', () => {
    expect(identificador('User', 'postgresql')).toBe('"User"');
    expect(identificador('User', 'sqlite')).toBe('"User"');
    expect(identificador('User', 'mysql')).toBe('`User`');
    expect(DEFINICION_MOTOR.mysql.comilla).toBe('`');
  });

  it('construye un INSERT con varias filas', () => {
    expect(
      sentenciaInsert(
        definicion,
        [
          ['u1', true],
          ['u2', false],
        ],
        'postgresql',
      ),
    ).toBe(`INSERT INTO "User" ("id", "active") VALUES ('u1', TRUE), ('u2', FALSE);`);
  });

  it('usa las comillas de MySQL', () => {
    expect(sentenciaInsert(definicion, [['u1', true]], 'mysql')).toBe(
      'INSERT INTO `User` (`id`, `active`) VALUES (\'u1\', 1);',
    );
  });

  it('borra en orden inverso (los hijos primero)', () => {
    const sentencias = sentenciasBorrado(
      [
        { modelo: 'user', tabla: 'User', etiqueta: 'Usuarios', columnas: [] },
        { modelo: 'attempt', tabla: 'Attempt', etiqueta: 'Intentos', columnas: [] },
      ],
      'postgresql',
    );
    expect(sentencias).toEqual(['DELETE FROM "User";', 'DELETE FROM "Attempt";']);
  });
});

const RESPALDO: DatosVolcadoJson = {
  version: 1,
  generadoEn: '2026-01-01T00:00:00.000Z',
  motor: 'sqlite',
  tablas: [
    {
      tabla: 'User',
      columnas: ['id', 'email', 'name', 'passwordHash', 'role', 'active', 'createdAt', 'updatedAt'],
      filas: [
        ['u1', 'a@colegio.edu', 'Ana', 'hash', 'ADMIN', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ],
    },
  ],
};

describe('volcadoDesdeJson', () => {
  it('coacciona los tipos de columna usando el catalogo', () => {
    const volcado = volcadoDesdeJson(RESPALDO);
    expect(volcado.tablas).toHaveLength(TABLAS.length);

    const usuarios = volcado.tablas.find((tabla) => tabla.tabla === 'User');
    expect(usuarios?.filas).toHaveLength(1);
    expect(usuarios?.filas[0]?.[5]).toBe(true);
    expect(usuarios?.filas[0]?.[6]).toBeInstanceOf(Date);
    expect(volcado.totalFilas).toBe(1);
  });

  it('rellena con vacio las tablas que faltan en el archivo', () => {
    const volcado = volcadoDesdeJson(RESPALDO);
    const grupos = volcado.tablas.find((tabla) => tabla.tabla === 'Group');
    expect(grupos?.filas).toEqual([]);
  });

  it('genera los INSERT y respeta el tamano del lote', () => {
    const volcado = volcadoDesdeJson(RESPALDO);
    const sentencias = sentenciasInsert(volcado, 'postgresql');
    expect(sentencias).toHaveLength(1);
    expect(sentencias[0]).toContain('INSERT INTO "User"');
    expect(sentencias[0]).toContain("'Ana'");
    expect(sentencias[0]).toContain('TRUE');
  });

  it('serializa a JSON y se puede volver a leer', () => {
    const volcado = volcadoDesdeJson(RESPALDO);
    const texto = volcadoAJson(volcado);
    const releido = JSON.parse(texto) as DatosVolcadoJson;
    expect(releido.version).toBe(1);
    expect(releido.motor).toBe('sqlite');
    expect(releido.tablas.find((tabla) => tabla.tabla === 'User')?.filas).toHaveLength(1);
  });
});

describe('esquema de Prisma', () => {
  it('lee el provider solo del bloque datasource', () => {
    expect(proveedorDelEsquema(ESQUEMA)).toBe('sqlite');
    expect(proveedorDelEsquema('generator client {\n  provider = "prisma-client-js"\n}')).toBeNull();
  });

  it('cambia el provider sin tocar el generator', () => {
    const cambiado = esquemaConProveedor(ESQUEMA, 'postgresql');
    expect(proveedorDelEsquema(cambiado)).toBe('postgresql');
    expect(cambiado).toContain('provider = "prisma-client-js"');
    expect(esquemaConProveedor(ESQUEMA, 'mysql')).toContain('provider = "mysql"');
  });
});

describe('esquemaConexion', () => {
  it('acepta una conexion PostgreSQL completa y convierte el puerto', () => {
    const resultado = esquemaConexion.safeParse({
      motor: 'postgresql',
      host: 'localhost',
      puerto: '5432',
      baseDatos: 'quizcolegio',
      usuario: 'admin',
      contrasena: 'clave',
    });
    expect(resultado.success).toBe(true);
    expect(resultado.success && resultado.data.puerto).toBe(5432);
  });

  it('exige el servidor en PostgreSQL', () => {
    const resultado = esquemaConexion.safeParse({
      motor: 'postgresql',
      puerto: 5432,
      baseDatos: 'db',
      usuario: 'u',
    });
    expect(resultado.success).toBe(false);
  });

  it('exige una ruta absoluta en SQLite', () => {
    expect(esquemaConexion.safeParse({ motor: 'sqlite', archivo: 'C:/datos/x.db' }).success).toBe(true);
    expect(esquemaConexion.safeParse({ motor: 'sqlite', archivo: '/var/lib/x.db' }).success).toBe(true);
    expect(esquemaConexion.safeParse({ motor: 'sqlite', archivo: 'file:C:/datos/x.db' }).success).toBe(true);
    expect(esquemaConexion.safeParse({ motor: 'sqlite', archivo: './x.db' }).success).toBe(false);
    expect(esquemaConexion.safeParse({ motor: 'sqlite' }).success).toBe(false);
  });

  it('rechaza un motor desconocido', () => {
    expect(esquemaConexion.safeParse({ motor: 'oracle', archivo: './x.db' }).success).toBe(false);
  });
});

describe('esquemaRespaldo', () => {
  it('acepta un respaldo con tablas', () => {
    expect(esquemaRespaldo.safeParse(RESPALDO).success).toBe(true);
  });

  it('rechaza un respaldo vacio', () => {
    expect(esquemaRespaldo.safeParse({ ...RESPALDO, tablas: [] }).success).toBe(false);
    expect(esquemaRespaldo.safeParse({}).success).toBe(false);
  });
});

describe('inicializacion sin datos de prueba', () => {
  it('conserva la configuracion y la auditoria', () => {
    expect(esTablaConservada('Setting')).toBe(true);
    expect(esTablaConservada('AuditLog')).toBe(true);
    expect(esTablaConservada('User')).toBe(false);
  });

  it('vacia todas las tablas de trabajo en orden seguro', () => {
    const tablas = tablasQueSeVacian().map((definicion) => definicion.tabla);
    const nombres = TABLAS.map((definicion) => definicion.tabla);

    expect(tablas).not.toContain('Setting');
    expect(tablas).not.toContain('AuditLog');
    expect([...tablas].sort()).toEqual(nombres.filter((t) => !esTablaConservada(t)).sort());

    // Las hijas se borran antes que las tablas de las que dependen.
    const posicion = (tabla: string) => tablas.indexOf(tabla);
    expect(posicion('Answer')).toBeLessThan(posicion('Attempt'));
    expect(posicion('Answer')).toBeLessThan(posicion('Question'));
    expect(posicion('QuizQuestion')).toBeLessThan(posicion('Quiz'));
    expect(posicion('QuestionOption')).toBeLessThan(posicion('Question'));
    expect(posicion('GroupMembership')).toBeLessThan(posicion('Group'));
    expect(posicion('Session')).toBeLessThan(posicion('User'));
  });

  it('conserva la cuenta que ejecuta la accion y sus sesiones', () => {
    expect(filtroVaciar('user', 'u-1')).toEqual({ where: { id: { not: 'u-1' } } });
    expect(filtroVaciar('session', 'u-1')).toEqual({ where: { userId: { not: 'u-1' } } });
  });

  it('vacia por completo el resto de las tablas', () => {
    for (const tabla of tablasQueSeVacian()) {
      if (tabla.modelo === 'user' || tabla.modelo === 'session') continue;
      expect(filtroVaciar(tabla.modelo, 'u-1')).toBeNull();
    }
  });
});

describe('administrador inicial', () => {
  it('usa ADMIN_EMAIL y ADMIN_PASSWORD cuando estan definidos', () => {
    const admin = resolverAdministradorInicial({
      ADMIN_EMAIL: '  jefa@colegio.edu  ',
      ADMIN_PASSWORD: 'UnaClaveLarga1',
      ADMIN_NAME: '  Rectora  ',
    });

    expect(admin.correo).toBe('jefa@colegio.edu');
    expect(admin.nombre).toBe('Rectora');
    expect(admin.contrasena).toBe('UnaClaveLarga1');
    expect(admin.generada).toBe(false);
    expect(admin.aviso).toBeNull();
  });

  it('genera una contrasena cuando no hay ADMIN_PASSWORD', () => {
    const admin = resolverAdministradorInicial({});

    expect(admin.correo).toBe(CORREO_ADMIN_POR_DEFECTO);
    expect(admin.generada).toBe(true);
    expect(admin.contrasena.length).toBeGreaterThanOrEqual(LARGO_MINIMO_CONTRASENA);
    expect(admin.aviso).toBeNull();
  });

  it('avisa y genera otra contrasena si ADMIN_PASSWORD es demasiado corta', () => {
    const admin = resolverAdministradorInicial({ ADMIN_PASSWORD: 'corta' });

    expect(admin.generada).toBe(true);
    expect(admin.contrasena).not.toBe('corta');
    expect(admin.aviso).toContain('8');
  });

  it('genera contrasenas distintas y de la longitud pedida', () => {
    const una = generarContrasena();
    const otra = generarContrasena();

    expect(una).not.toBe(otra);
    expect(una).toHaveLength(16);
    expect(generarContrasena(24)).toHaveLength(24);
    expect(generarContrasena(2).length).toBeGreaterThanOrEqual(LARGO_MINIMO_CONTRASENA);
  });
});
