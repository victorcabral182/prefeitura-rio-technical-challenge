#!/bin/sh
# Só desenvolvimento. O usuário da aplicação ganha permissão de criar/apagar
# bancos e acesso total apenas a dois grupos de bancos auxiliares:
# - shadow databases que o `prisma migrate dev` cria e apaga para validar migrations;
# - `corridas_test`, usado pelos testes de integração (`npm run test:integration`).
# Roda uma única vez, quando o volume do MySQL é criado.
mysql --protocol=socket -uroot -p"$MYSQL_ROOT_PASSWORD" <<SQL
GRANT CREATE, DROP ON *.* TO '$MYSQL_USER'@'%';
GRANT ALL PRIVILEGES ON \`prisma\_migrate\_shadow\_db\_%\`.* TO '$MYSQL_USER'@'%';
GRANT ALL PRIVILEGES ON \`corridas\_test\`.* TO '$MYSQL_USER'@'%';
SQL
