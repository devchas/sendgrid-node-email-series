import Sequelize from 'sequelize';
import Faker from 'faker';
import _ from 'lodash';

const Conn = new Sequelize('email_series', 'devinchasanoff', 'password', {
  dialect: 'postgres',
  host: 'localhost'
});

const User = Conn.define('user', {
  email: { type: Sequelize.STRING, allowNull: false },
  firstName: { type: Sequelize.STRING },
  lastName: { type: Sequelize.STRING }
});

exports.populate = () => {
  if (process.env.NODE_ENV !== 'test') {
    Conn.sync({ force: true }).then(() => {
      _.times(50, () => {
        User.create({ 
          email: Faker.internet.email().toLowerCase(),
          firstName: Faker.name.firstName(),
          lastName: Faker.name.lastName() 
        });
      }); 
    });
  }
}

export default Conn;