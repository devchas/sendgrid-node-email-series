import Sequelize from 'sequelize';
import Faker from 'faker';
import _ from 'lodash';
import { series } from './index';

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
      _.times(series.length, i => {
        User.create({ 
          email: Faker.internet.email().toLowerCase(),
          firstName: Faker.name.firstName(),
          lastName: Faker.name.lastName(),
          createdAt: new Date(new Date() - (series[i].days * 24 * 60 * 60 * 1000))
        });
      }); 
    });
  }
}

function randomInt(min, max) {
  return Math.round((Math.random() * (max - min) + min));
}

export default Conn;