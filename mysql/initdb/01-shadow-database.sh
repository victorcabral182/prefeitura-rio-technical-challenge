#!/bin/sh
# Só desenvolvimento: o `prisma migrate dev` cria e apaga um banco temporário
# (shadow database) para validar as migrations. O usuário da aplicação ganha
# permissão de criar/apagar bancos e acesso total apenas aos shadow databases.
# Roda uma única vez, quando o volume do MySQL é criado.
mysql --protocol=socket -uroot -p"$MYSQL_ROOT_PASSWORD" <<SQL
GRANT CREATE, DROP ON *.* TO '$MYSQL_USER'@'%';
GRANT ALL PRIVILEGES ON \`prisma\_migrate\_shadow\_db\_%\`.* TO '$MYSQL_USER'@'%';
SQL
